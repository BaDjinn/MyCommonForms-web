# LocalForm
LocalForm detects form fields in PDF documents and creates a fillable PDF directly in the browser. PDF processing is local: documents are not uploaded to an application server.
The field detection pipeline is based on [CommonForms](https://github.com/jbarrow/commonforms), uses [ONNX Runtime Web](https://onnxruntime.ai/) and retains integration with [SimplePDF](https://simplepdf.com).
## Local development
```sh
npm install
npm run dev
```
