var edge = require('edge');

module.exports = function(options){

	var template = '\
#r "Orleans.dll" \n\
#r "OrleansRuntime.dll" \n\
#r "OrleansProviders.dll" \n\
#r "OrleansAzureUtils.dll" \n\
#r "Microsoft.WindowsAzure.Configuration.dll" \n\
#r "Microsoft.WindowsAzure.Storage.dll" \n\
#r "Newtonsoft.Json.dll" \n\
#r "$(grainDll)"  \n\
using $(grainNamespace); \n\
using Orleans; \n\
using System; \n\
using System.Threading.Tasks; \n\
public class Startup \n\
{  \n\
    public async Task<string> Invoke(object input)  \n\
    {  \n\
		$(innerCs) \n\
    } \n\
}\n\
'

	function escapeString(value){
		if (typeof value === "string") return '"' + value + '"';
		return value;
	}

	function getFuncTemplate(innerCs){
		return template
			.replace("$(grainDll)", options.grainDll)
			.replace("$(grainNamespace)", options.grainNamespace)
			.replace("$(innerCs)", innerCs);
	}

	function argsToString(args){
		return args.map(escapeString).join(", ");
	}

	function formatId(grainId){
		if (typeof grainId === "string") return "Guid.Parse(" + escapeString(grainId) + ")";
		if (Array.isArray(grainId)) return argsToString(grainId);
		return grainId.toString();
	}

	return {
		init: function(callback){
			var cs = getFuncTemplate("GrainClient.Initialize();\nreturn TaskDone.Done;")
			edge.func(cs)(null, callback);
		},
		call: function(grainType, grainId, grainMethod, arguments, callback){
			if (!callback) throw new Error("no callback defined");

			// does the callback have a result argument defined?
			var hasReturnValue = /\(([^)]+)/.exec(callback.toString())[1].split(/\s*,\s*/).length >= 2;

			if (hasReturnValue){
				var innerCs = "\
				var grain = GrainClient.GrainFactory.GetGrain<" + grainType + ">(" + formatId(grainId) + ");\n\
				var result = await grain." + grainMethod + "(" + argsToString(arguments) + ");\n\
				return Task.FromResult(JsonConvert.SerializeObject(result));\n\
				";
			} else {
				var innerCs = "\
				var grain = GrainClient.GrainFactory.GetGrain<" +  grainType + ">(" + formatId(grainId) + ");\n\
				await grain." + grainMethod + "(" + argsToString(arguments) + ");\n\
				return Task.FromResult(String.Empty);\n\
				";
			}

			var cs = getFuncTemplate(innerCs)
			edge.func(cs)(null, callback);
		}
	};
}



