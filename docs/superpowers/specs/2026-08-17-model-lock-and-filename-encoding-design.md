# Model Lock And Filename Encoding Design

## Scope

All model requests use `OPENAI_MODEL`. The application offers no model selection
or request-time model override. Uploaded UTF-8 Chinese filenames remain readable
after the multipart upload path.

## Design

- The server has one analysis-model setting, `config.model`, sourced from
  `OPENAI_MODEL`.
- The analysis endpoint does not read a model value from the client request.
  Its draft and optional review both receive `config.model`.
- The public configuration exposes the configured model for status display only;
  it does not expose an available-model list or review-model setting.
- The client removes model-picker state, controls, and API payload fields. It
  displays the configured model in analysis progress and historical metadata.
- Multer is configured to decode multipart parameter values as UTF-8, so browser
  uploads preserve Chinese filenames before the filename is stored with the PRD.

## Error Handling

Model configuration errors remain unchanged: analysis is unavailable until
`OPENAI_API_KEY` is configured. A request-supplied `model` property is ignored.
Existing stored PRD model trace fields remain readable as historical data.

## Verification

- Build the Vue application.
- Verify the model configuration and analysis request path cannot accept a model
  override and use `OPENAI_MODEL` for both stages.
- Exercise the upload parser with a Chinese filename and confirm the returned
  PRD title preserves the original characters.
