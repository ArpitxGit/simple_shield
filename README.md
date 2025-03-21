# simple_shield
Basic Noir private proof of membership

## Requirements

- Noir is based upon [Rust](https://www.rust-lang.org/tools/install), and we will need Noir's package manager `nargo` in order to compile our circuits. Further installation instructions can be found [here](https://noir-lang.org/getting_started/nargo_installation).
- The typescript tests and contracts live within a hardhat project, where we use [yarn](https://classic.yarnpkg.com/lang/en/docs/install/#mac-stable) as the package manager.

## Development

There are two projects under this repository. One is a more basic private transfer application that is suited for applications such as private airdrops or private lotteries. The second is a full private transfer application that interacts with a merkle tree in Solidity. This walkthrough will just follow the full private transfer application. Feel free to replace the respective commands to test the full basic private transfer.

Start by installing all the packages specified in the `package.json`

```shell
yarn install
```

After installing nargo it should be placed in our path and can be called from inside the `circuits` folder. We will then compile our circuit. This will generate an intermediate representation that is called the ACIR. More infomration on this can be found [here](https://noir-lang.github.io/book/acir.html). `p` in `nargo compile p` is simply the name of the ACIR and witness files generated by Noir when compiling the circuit. These will be used by the tests. 

```shell
cd circuits/mimc_tree
nargo compile p
```

You will also notice inputs in `Prover.toml` that satisfy the specified circuit constraints. This toml file has been filled based on calculations done previously inside of the test files. You can run `nargo prove p` followed by `nargo verify p` to prove and verify a circuit natively. More info on the `nargo` commands can be found in the Noir documentation linked above.

This example aims to show different strategies for proving and verifying zk proofs with Noir. The rest of this README will describe how to prove and verify Noir circuits in typescript.

We use these three packages to interact with the ACIR. `@noir-lang/noir_wasm` lets us serialize the ACIR from file. 
```
let acirByteArray = path_to_uint8array(path.resolve(__dirname, '../circuits/build/p.acir'));
let acir = acir_read_bytes(acirByteArray);
```

It is also possible to instead compile the program in Typescript. This can be seen inside the test file. Using this strategy would allow a developer to avoid use of the `nargo compile` command.

```
let compiled_program = compile(resolve(__dirname, '../circuits/src/main.nr);
const acir = compiled_program.circuit;
```

Then `@noir-lang/barretenberg` is used to generate a proof and verify that proof. We first specify the ABI for the circuit. This contains all the public and private inputs to the program and is generated by the prover. In the case of our typescript tests, each test acts as both the prover and the verifier, and only passes if the proof passes verification.

These values in the `abi` are all calculated inside the test file for each test, but an example is written out here.
```
let abi = {
  recipient: recipient,
  priv_key: `0x` + transfers[0].sender_priv_key.toString('hex'),
  note_root: `0x` + note_root, 
  index: 0,
  note_hash_path: generateHashPathInput(note_hash_path),
  secret: `0x` + transfers[0].secret.toString('hex'),
  nullifierHash: `0x` + transfers[0].nullifier.toString('hex'),
};
```

We will then construct our prover and verifier from the ACIR, and generate a proof from the prover, ACIR, and newly specified ABI. 

```
let [prover, verifier] = await setup_generic_prover_and_verifier(acir);

const proof = await create_proof(prover, acir, abi);
```

The `verify_proof` method then takes in the previously generated verifier and proof and returns either `true` or `false`. A verifier also needs to accept the circuits public inputs in order to be valid. Our prover prepends the public inputs to the proof. 

```
const verified = await verify_proof(verifier, proof);
```

### Solidity Verifier

Once we have compiled our program and generated an ACIR, we can generate a Solidity verifier rather than having to use the verifier provided by `nargo` or Noir's typescript wrapper. 

This Solidity verifier can also be generated by calling `nargo contract`. This will produce a Solidity verifier inside of the Noir project which you can then move into the correct `contracts` folder.

It is important to note that if you change your circuit and want to verify proofs in Solidity you must also regenerate your Solidity verifier. The verifier is based upon the circuit and if the circuit changes any previous verifier will be out of date. 

### Running tests

The tests use the method of compiling the circuit using `nargo`. The tests also show how to complete proof verification using Typescript as well as with the Solidity verifier. Thus, to have all tests pass, it is necessary you follow all the commands listed or change the tests to your preferred method of compilation and/or proof verification.

The full private transfer app uses a MiMC hasher contract for calculating merkle tree roots. In order for all the tests to pass you must compile the hasher contract separately. 

```
mkdir build
npx ts-node ./scripts/compileHasher.ts
```

This command will compile the Solidity verifier within the `contracts` folder and run all tests inside `./test/PrivateTransfer-full.test.ts`.
```
npx hardhat test ./test/PrivateTransfer-full.test.ts
```
