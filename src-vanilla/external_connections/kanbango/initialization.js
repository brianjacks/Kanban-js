"use strict";

/**
 * @type {Object.<string,{rpcCall:string, method: string, mandatoryFixedArguments: Object, mandatoryModifiableArguments: Object, optionalArguments: Object, types: Object, parameters: string[]}>}
 */
var rpcCalls = {
  runNodesDetached: {
    rpcCall: "runNodesDetached",
    mandatoryFixedArguments: { //<- values give defaults, null for none
    },
    mandatoryModifiableArguments: { //<- values give defaults, null for none
      numberOfNodes: null
    },
  },
  runNodesOnFAB: {
    rpcCall: "runNodesOnFAB",
    mandatoryFixedArguments: { //<- values give defaults, null for none
    },
    mandatoryModifiableArguments: { //<- values give defaults, null for none
      numberOfNodes: null
    },
  },
  getLogFile: {
    rpcCall: "getLogFile",
  },
  getRPCLogFile: {
    rpcCall: "getRPCLogFile",
  },  
  getNodeInformation: {
    rpcCall: "getNodeInformation",
  },
  compileSolidity: {
    rpcCall: "compileSolidity",
    mandatoryModifiableArguments: {
      code: null
    }
  },
  fetchKanbanContract: {
    rpcCall: "fetchKanbanContract",    
  }
};

module.exports = {
  rpcCalls
}

