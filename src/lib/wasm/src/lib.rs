use wasm_bindgen::prelude::*;
use data_encoding::HEXUPPER;
use ring::digest::{Context, SHA256};
use web_sys::console;

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

fn verify_nonce(result: &Vec<u8>, target: &Vec<u8>) -> bool {
    if result.len() != target.len() {
        return false;
    }
    for i in 0..(result.len() - 1) {
        if result[i] > target[i] {
            return false;
        } else if result[i] < target[i] {
            break;
        }
    }
    return true;
}

#[wasm_bindgen]
pub fn solve_challenge(prefix: &str, target_hex: &str) -> String {
    let mut nonce = 0;
    let mut hashed;
    let target = HEXUPPER.decode(target_hex.as_bytes()).unwrap();
    
    loop {
        let mut context = Context::new(&SHA256);
        let input = format!("{}{}", prefix, nonce);
        context.update(input.as_bytes());
        hashed = context.finish().as_ref().to_vec();
        
        // Report progress every 10000 attempts using console.log
        if nonce % 10000 == 0 {
            console::log_1(&JsValue::from_f64(nonce as f64));
        }
        
        let result = verify_nonce(&hashed, &target);
        if result {
            break;
        } else {
            nonce += 1;
        }
    }
    nonce.to_string()
}