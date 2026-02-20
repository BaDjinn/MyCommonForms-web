# PLEASE

Refer to the original page from where I forked from. This is my PERSONAL spin on the original, and i don't do support.

## Major differences

- confidence thershold now with 2 decimals
- ONNX runtime web now in the WebCNN version with fallback: NPU->GPU->WebGPU->WASM(CPU)
- minor aestethical changes

## To Do

[] Add "Keep previous modules"
[] Add a label which states the type of accelerator used

# CommonForms in Browser

## [Try it here](https://commonforms.simplepdf.com)

<img width="1674" height="898" alt="Screenshot 2025-10-19 at 11 35 20" src="https://github.com/user-attachments/assets/953a9edd-59a3-48ed-86a2-99e3fd15a005" />

## About this repository

This repository show-cases the use of [CommonForms](https://github.com/jbarrow/commonforms) in the browser, powered by [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)

The most important pieces of logic are located over here:

- [formFieldDetection](./src/lib/formFieldDetection.ts): the core logic using the model to detect the fields
- [applyAcroFields](./src/lib/applyAcroFields.ts): the logic responsible for turning the detected fields into acrofields, ie, fillable widgets.

## Running locally

1. Install the dependencies

```sh
npm install
```

2. Run the dev server

```sh
npm run dev
```

3. Open your browser and navigate to http://localhost:5173/
