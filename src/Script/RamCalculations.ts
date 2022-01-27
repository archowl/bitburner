/**
 * Implements RAM Calculation functionality.
 *
 * Uses the acorn.js library to parse a script's code into an AST and
 * recursively walk through that AST, calculating RAM usage along
 * the way
 */
import * as walk from "acorn-walk";
import acorn, { parse } from "acorn";
import { RamCosts, RamCostConstants } from "../Netscript/RamCostGenerator";
import { Script } from "../Script/Script";
import { IPlayer } from "../PersonObjects/IPlayer";
import {calculateRamUsage as calculateRamUsageAlt} from './RamCalculationsAlt';


export interface RamUsageEntry {
  type: 'ns' | 'dom' | 'fn' | 'misc';
  name: string;
  cost: number;
}

export interface RamCalculation {
  cost: number;
  entries?: RamUsageEntry[];
}

export function getRamCalculationForKeys(player: IPlayer, keys: Iterable<string>): RamCalculation {
  let entries: RamUsageEntry[] = [{ type: 'misc', name: 'baseCost', cost: RamCostConstants.ScriptBaseRamCost}];
  const seen: Set<string> = new Set();
  for(const key of keys){
    if(seen.has(key))
      continue;
    seen.add(key);
    // Check if this is one of the special keys, and add the appropriate ram cost if so.
    switch(key){
      case 'hacknet': {
        entries.push({ type: 'ns', name: 'hacknet', cost: RamCostConstants.ScriptHacknetNodesRamCost});
        continue;
      }
      case 'document': {
        entries.push({ type: 'dom', name: 'document', cost: RamCostConstants.ScriptDomRamCost});
        continue;
      }
      case 'window': {
        entries.push({ type: 'dom', name: 'window', cost: RamCostConstants.ScriptDomRamCost});
        continue;
      }
      case 'corporation': {
        entries.push({ type: 'ns', name: 'corporation', cost: RamCostConstants.ScriptCorporationRamCost});
        continue;
      }
    }

    let cost, name: string | null = null;
    for(const namespace of ['bladeburner', 'codingcontract', 'stanek', 'gang', 'sleeve', 'stock', 'ui']){
      if(key in RamCosts[namespace]){
        cost = RamCosts[namespace][key];
        name = `${namespace}.${key}`;
        break;
      }
    }
    if(name == null){
      cost = RamCosts[key];
      name = key;
    }

    if(typeof cost === 'function')
      cost = cost(player);
    else if(typeof cost !== 'number')
      cost = 0;
    if(cost == 0)
      continue;

    entries.push({ type: 'fn', name, cost});
  }
  entries = entries.filter(entry => entry.cost > 0);
  let totalRam = 0;
  for(const entry of entries)
    totalRam += entry.cost;
  return {cost: totalRam, entries};
}

export function checkInfiniteLoop(code: string): number {
  const ast = parse(code, { sourceType: "module", ecmaVersion: "latest" });

  function nodeHasTrueTest(node: acorn.Node): boolean {
    return node.type === "Literal" && (node as any).raw === "true";
  }

  function hasAwait(ast: acorn.Node): boolean {
    let hasAwait = false;
    walk.recursive(
      ast,
      {},
      {
        AwaitExpression: () => {
          hasAwait = true;
        },
      },
    );
    return hasAwait;
  }

  let missingAwaitLine = -1;
  walk.recursive(
    ast,
    {},
    {
      WhileStatement: (node: acorn.Node, st: any, walkDeeper: walk.WalkerCallback<any>) => {
        if (nodeHasTrueTest((node as any).test) && !hasAwait(node)) {
          missingAwaitLine = (code.slice(0, node.start).match(/\n/g) || []).length + 1;
        } else {
          (node as any).body && walkDeeper((node as any).body, st);
        }
      },
    },
  );

  return missingAwaitLine;
}

/**
 * Calculate's a scripts RAM Usage
 * @param {string} codeCopy - The script's code
 * @param {Script[]} otherScripts - All other scripts on the server.
 *                                  Used to account for imported scripts
 */
export async function calculateRamUsage(
  player: IPlayer,
  filename: string,
  codeCopy: string,
  otherScripts: Script[],
): Promise<RamCalculation> {
  return calculateRamUsageAlt(player, filename, codeCopy, otherScripts);
}
