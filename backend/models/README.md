# Model folder

`TMP_MODEL_DIR` (default `backend/models/current/`) must contain the files written by
`ml/tomypetal_ml/train.py`:

- `metadata.json`: classes, preprocessing, calibration temperature, abstention thresholds, weights checksum
- `model.pt`: the fine-tuned weights (`state_dict`)
- `metrics.json` (optional, from `evaluate.py`): shown in the app, clearly split into lab and real-world results

Weights are not committed to git. On start-up the API validates the metadata schema, the
architecture, that every class is known to the app, the SHA-256 of the weights, strict
weight loading and a test forward pass. If any check fails, the app keeps working and every
analysis reports "Image analysis is unavailable right now" with the reason.

See [docs/MODEL_CARD.md](../../docs/MODEL_CARD.md) and [ml/README.md](../../ml/README.md).
