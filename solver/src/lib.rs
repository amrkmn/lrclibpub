use sha2::{Digest, Sha256};
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

// We'll use a callback approach instead of external imports
static mut PROGRESS_CALLBACK: Option<js_sys::Function> = None;

#[wasm_bindgen(js_name = "setProgressCallback")]
pub fn set_progress_callback(callback: js_sys::Function) {
    unsafe {
        PROGRESS_CALLBACK = Some(callback);
    }
}

fn report_progress(value: f64) {
    unsafe {
        if let Some(ref callback) = PROGRESS_CALLBACK {
            let _ = callback.call1(&JsValue::NULL, &JsValue::from_f64(value));
        }
    }
}

#[wasm_bindgen(js_name = "solveChallenge")]
pub fn solve_challenge(prefix: &str, target_hex: &str) -> String {
    // Convert target hex string to bytes for comparison
    let target_bytes = hex::decode(target_hex).expect("Invalid target hex string");

    let mut nonce = 0;

    loop {
        // Create the input string: prefix + nonce
        let input = format!("{}{}", prefix, nonce);

        // Calculate SHA256 hash
        let mut hasher = Sha256::new();
        hasher.update(input.as_bytes());
        let hash = hasher.finalize();

        // Report progress without using console.log
        if nonce % 10000 == 0 {
            report_progress(nonce as f64);
        }

        // Check if hash is less than or equal to target
        if hash.as_slice() <= target_bytes.as_slice() {
            break;
        }

        nonce += 1;

        // Prevent overflow (though this is unlikely to be reached)
        if nonce == u64::MAX {
            println!("⚠️  Reached maximum nonce value without finding solution");
            break;
        }
    }
    nonce.to_string()
}
