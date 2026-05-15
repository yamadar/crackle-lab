// Algorithm registry: maps algo id -> pure (params, rand) => { segments }.
import { algoVoronoi } from './voronoi.js';
import { algoRecursive } from './recursive.js';
import { algoGrowth } from './growth.js';
import { algoGrammar } from './grammar.js';

export const algorithms = {
  voronoi: algoVoronoi,
  recursive: algoRecursive,
  growth: algoGrowth,
  grammar: algoGrammar,
};

export { algoVoronoi, algoRecursive, algoGrowth, algoGrammar };
