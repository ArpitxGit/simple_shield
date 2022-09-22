// const circomlib = require("circomlib");
// import { mimcsponge } from "circomlibjs";
// const circomlibjs = require('circomlibjs');
// import { Pedersen, SinglePedersen } from '@aztec/barretenberg/crypto/pedersen';
// import { BarretenbergWasm } from '@aztec/barretenberg/wasm';
import { SinglePedersen } from '@noir-lang/barretenberg/dest/crypto/pedersen';
import { BarretenbergWasm } from '@noir-lang/barretenberg/dest/wasm';
// @ts-ignore
const circomlibjs = require('circomlibjs');

const mimcsponge = circomlibjs.mimcsponge;
// import { pedersenHashConcat } from "zkp-merkle-airdrop-lib"

export function MiMCSponge(left: string, right: string): string {
  return mimcsponge.multiHash([BigInt(left), BigInt(right)]).toString();
}

/** Compute pedersen hash */
export function pedersenHash(data: any[]): string {
  console.log(circomlibjs.pedersenHash);
  // let hash = circomlibjs.pedersenHash.hash(data);
  // return circomlibjs.babyJub.unpackPoint(hash)[0].toString();
  let hash = mimcsponge.multiHash(data);
  console.log(hash);
  return hash.toString();
}

export function pedersenLeftRight(
  barretenberg: BarretenbergWasm, 
  left: string, 
  right: string): string {
    let leftBuffer = Buffer.from(left, 'hex');
    let rightBuffer = Buffer.from(right, 'hex');
    let pedersen = new SinglePedersen(barretenberg);
    let hashRes = pedersen.compress(leftBuffer, rightBuffer);
    return hashRes.toString('hex')
}

export interface IMerkleTree {
  root: () => string;
  proof: (index: number) => {
    root: string;
    pathElements: string[];
    pathIndices: number[];
    leaf: string;
  };
  insert: (leaf: string) => void;
}

export class MerkleTree implements IMerkleTree {
  // readonly zeroValue = "1cdcf02431ba623767fe389337d011df1048dcc24b98ed81cec97627bab454a0";
  readonly zeroValue = "0000000000000000000000000000000000000000000000000000000000000000";
  levels: number;
  hashLeftRight: (barretenberg: BarretenbergWasm, left: string, right: string) => string;
  storage: Map<string, string>;
  zeros: string[];
  totalLeaves: number;
  barretenberg: BarretenbergWasm;

  constructor(
    levels: number, 
    barretenberg: BarretenbergWasm,
    defaultLeaves: string[] = [], 
    hashLeftRight = pedersenLeftRight) {
    this.levels = levels;
    this.hashLeftRight = hashLeftRight;
    this.storage = new Map();
    this.zeros = [];
    this.totalLeaves = 0;
    this.barretenberg = barretenberg;

    // build zeros depends on tree levels
    let currentZero = this.zeroValue;
    this.zeros.push(currentZero);
    for (let i = 0; i < levels; i++) {
      currentZero = this.hashLeftRight(barretenberg, currentZero, currentZero);
      this.zeros.push(currentZero);
    }

    if (defaultLeaves.length > 0) {
      this.totalLeaves = defaultLeaves.length;

      // store leaves with key value pair
      let level = 0;
      defaultLeaves.forEach((leaf, index) => {
        this.storage.set(MerkleTree.indexToKey(level, index), leaf);
      });

      // build tree with initial leaves
      level++;
      let numberOfNodesInLevel = Math.ceil(this.totalLeaves / 2);
      for (level; level <= this.levels; level++) {
        for (let i = 0; i < numberOfNodesInLevel; i++) {
          const leftKey = MerkleTree.indexToKey(level - 1, 2 * i);
          const rightKey = MerkleTree.indexToKey(level - 1, 2 * i + 1);

          const left = this.storage.get(leftKey);
          const right = this.storage.get(rightKey) || this.zeros[level - 1];
          if (!left) throw new Error("leftKey not found");

          const node = this.hashLeftRight(barretenberg, left, right);
          this.storage.set(MerkleTree.indexToKey(level, i), node);
        }
        numberOfNodesInLevel = Math.ceil(numberOfNodesInLevel / 2);
      }
    }
  }

  static indexToKey(level: number, index: number): string {
    return `${level}-${index}`;
  }

  getIndex(leaf: string): number {
    for (const [key, value] of this.storage) {
      if (value === leaf) {
        return Number(key.split("-")[1]);
      }
    }
    return -1;
  }

  root(): string {
    return this.storage.get(MerkleTree.indexToKey(this.levels, 0)) || this.zeros[this.levels];
  }

  proof(indexOfLeaf: number) {
    let pathElements: string[] = [];
    let pathIndices: number[] = [];

    const leaf = this.storage.get(MerkleTree.indexToKey(0, indexOfLeaf));
    if (!leaf) throw new Error("leaf not found");

    // store sibling into pathElements and target's indices into pathIndices
    const handleIndex = (level: number, currentIndex: number, siblingIndex: number) => {
      const siblingValue = this.storage.get(MerkleTree.indexToKey(level, siblingIndex)) || this.zeros[level];
      pathElements.push(siblingValue);
      pathIndices.push(currentIndex % 2);
    };

    this.traverse(indexOfLeaf, handleIndex);

    return {
      root: this.root(),
      pathElements,
      pathIndices,
      leaf: leaf,
    };
  }

  insert(leaf: string) {
    const index = this.totalLeaves;
    this.update(index, leaf, true);
    this.totalLeaves++;
  }

  update(index: number, newLeaf: string, isInsert: boolean = false) {
    if (!isInsert && index >= this.totalLeaves) {
      throw Error("Use insert method for new elements.");
    } else if (isInsert && index < this.totalLeaves) {
      throw Error("Use update method for existing elements.");
    }

    let keyValueToStore: { key: string; value: string }[] = [];
    let currentElement: string = newLeaf;

    const handleIndex = (level: number, currentIndex: number, siblingIndex: number) => {
      const siblingElement = this.storage.get(MerkleTree.indexToKey(level, siblingIndex)) || this.zeros[level];

      let left: string;
      let right: string;
      if (currentIndex % 2 === 0) {
        left = currentElement;
        right = siblingElement;
      } else {
        left = siblingElement;
        right = currentElement;
      }

      keyValueToStore.push({
        key: MerkleTree.indexToKey(level, currentIndex),
        value: currentElement,
      });
      currentElement = this.hashLeftRight(this.barretenberg, left, right);
    };

    this.traverse(index, handleIndex);

    // push root to the end
    keyValueToStore.push({
      key: MerkleTree.indexToKey(this.levels, 0),
      value: currentElement,
    });

    keyValueToStore.forEach(o => {
      this.storage.set(o.key, o.value);
    });
  }

  // traverse from leaf to root with handler for target node and sibling node
  private traverse(indexOfLeaf: number, handler: (level: number, currentIndex: number, siblingIndex: number) => void) {
    let currentIndex = indexOfLeaf;
    for (let i = 0; i < this.levels; i++) {
      let siblingIndex;
      if (currentIndex % 2 === 0) {
        siblingIndex = currentIndex + 1;
      } else {
        siblingIndex = currentIndex - 1;
      }

      handler(i, currentIndex, siblingIndex);
      currentIndex = Math.floor(currentIndex / 2);
    }
  }
}