# LocalForm

LocalForm detects form fields in PDF documents and creates a fillable PDF directly in the browser. PDF processing is local: user-provided documents are not uploaded to the application server.

## Development

```sh
npm ci
npm run dev
npm run check
```

## Architecture and attribution

Field detection uses the [CommonForms](https://github.com/jbarrow/commonforms) approach and FFDNet models from the original project by Joe Barrow. The local inference runtime is [ONNX Runtime Web](https://onnxruntime.ai/); PDF editing uses [pdf-lib](https://pdf-lib.js.org/). The application also integrates [SimplePDF](https://simplepdf.com/) for interactive PDF filling.

The model URLs and technical attribution are retained here; the end-user interface is branded simply as LocalForm.

## Installation

The Vite build publishes PWA assets from `public/` into `dist/`. Use Edge or Chrome on Windows to install the application in a standalone window. The manifest does not by itself provide offline model availability.

## CI

GitHub Actions runs type, formatting and production build checks. Deployment to Netlify is a separate, protected workflow and is not enabled solely by merging code.
