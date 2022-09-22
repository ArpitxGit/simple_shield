// use aztec_backend::barretenberg_rs::scalar_mul;
// use aztec_backend::barretenberg_rs::pedersen;
// use aztec_backend::barretenberg_rs::Barretenberg;
use aztec_backend::barretenberg_wasm::Barretenberg;
use acvm::FieldElement;
use aztec_backend::acvm_interop::pwg::merkle::{MerkleTree};
use tempfile::tempdir;

fn main() {
    let mut barretenberg = Barretenberg::new();

    // Just have these panic for now
    let to_pubkey_x = FieldElement::from_hex("0x0000000000000000000000000000000000000000000000000000000000000001").unwrap();
    let to_pubkey_y = FieldElement::from_hex("0x0000000000000002cf135e7506a45d632d270d45f1181294833fc48d823f272c").unwrap();
    println!("to_pubkey_x: {:?}", to_pubkey_x);
    let receiver_compress_native = barretenberg.compress_native(&to_pubkey_x, &to_pubkey_y);
    println!("receiver_compress_native: {:?}", receiver_compress_native.to_hex());

    let receiver_compress_many = barretenberg.compress_many(vec![to_pubkey_x]);
    println!("receiver_compress_many: {:?}", receiver_compress_many.to_hex());

    let index = FieldElement::zero();
    let priv_key = FieldElement::from_hex("0x000000000000000000000000000000000000000000000000000000616c696365").unwrap();
    println!("val: {:?}", priv_key);
    let res2 = barretenberg.fixed_base(&priv_key);
    println!("pubkey_x.0: {:?}", res2.0.to_hex());
    println!("pubkey_y.1: {:?}", res2.1.to_hex());

    // let pubkey_vec = vec![res2.0.to_bytes(), res2.1.to_bytes()];
    let note_commitment = barretenberg.encrypt(vec![res2.0, res2.1]);
    println!("note_commitment.0: {:?}", note_commitment.0.to_hex());
    println!("note_commitment.1: {:?}", note_commitment.1.to_hex());

    let nullifier = barretenberg.encrypt(vec![note_commitment.0, index, priv_key]);
    println!("nullifier.0: {:?}", nullifier.0.to_hex());
    println!("nullifier.1: {:?}", nullifier.1.to_hex());

    let receiver_note_commitment = barretenberg.encrypt(vec![to_pubkey_x, to_pubkey_y]);
    println!("receiver_note_commitment.0: {:?}", receiver_note_commitment.0.to_hex());
    println!("receiver_note_commitment.1: {:?}", receiver_note_commitment.1.to_hex());

    let temp_dir = tempdir().unwrap();
    let mut tree = MerkleTree::new(3, &temp_dir);

    let path = tree.get_hash_path(0);

    let mut note_hash_path = Vec::new();
    let mut index_bits = index.bits();
    index_bits.reverse();
    for (i, path_pair) in path.into_iter().enumerate() {
        let path_bit = index_bits[i];
        let hash =
            if !path_bit { path_pair.1 } else { path_pair.0 };
        note_hash_path.push(hash);
        println!("i {}", i);
    }

    let note_hash_path = note_hash_path.iter().map(|x| {
        println!("hash path elem: {:?}", x.to_hex());
        x
    }).collect();

    // NOTE: This block of code (until leaf is printed) gives the incorrect root and leaf as it uses blake2s to generate the note_commitment rather than pedersen 
    // let note_commitment_bytes = note_commitment.0.to_bytes();
    // let new_root = tree.update_message(0, &res2.0.to_bytes()[..]);
    // println!("new_root: {:?}", new_root.to_hex());
    // let leaf = hash(&res2.0.to_bytes()[..]);
    // println!("leaf: {:?}", leaf.to_hex());

    let root = check_membership(note_hash_path, &index, &note_commitment.0);
    println!("check_membership: {:?}", root.to_hex());

    tree.update_leaf(0, note_commitment.0);
    let expected_root = tree.root();
    println!("expected_root: {:?}", expected_root.to_hex());
}

pub fn check_membership(
    hash_path: Vec<&FieldElement>,
    //root: &FieldElement,
    index: &FieldElement,
    leaf: &FieldElement,
) -> FieldElement {
    let mut barretenberg = Barretenberg::new();

    let mut index_bits = index.bits();
    index_bits.reverse();

    let mut current = *leaf;

    for (i, path_elem) in hash_path.into_iter().enumerate() {
        let path_bit = index_bits[i];
        let (hash_left, hash_right) =
            if !path_bit { (current, *path_elem) } else { (*path_elem, current) };
        current = compress_native(&mut barretenberg, &hash_left, &hash_right);
    }
    current
}

fn compress_native(
    barretenberg: &mut Barretenberg,
    left: &FieldElement,
    right: &FieldElement,
) -> FieldElement {
    barretenberg.compress_native(left, right)
}
