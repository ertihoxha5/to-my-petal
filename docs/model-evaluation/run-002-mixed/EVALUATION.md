# Evaluation: pv15-mobilenetv3large-20261007-18cfae9b

## controlled_test

PlantVillage leaf-grouped test split. Lab-style photos of single leaves on plain backgrounds; NOT representative of photos taken in a garden or home.

- Images: 3434
- accuracy: 0.993
- macro_f1: 0.9928
- ece_calibrated: 0.0131
- abstention: {'accepted_fraction': 0.8631, 'accuracy_on_accepted': 1.0, 'flagged_unfamiliar_fraction': 0.0079}

| class | precision | recall | F1 | support |
|---|---|---|---|---|
| Pepper,_bell___Bacterial_spot | 1.0 | 1.0 | 1.0 | 154 |
| Pepper,_bell___healthy | 1.0 | 1.0 | 1.0 | 223 |
| Potato___Early_blight | 1.0 | 0.9803 | 0.99 | 152 |
| Potato___Late_blight | 0.9933 | 0.9737 | 0.9834 | 152 |
| Potato___healthy | 1.0 | 1.0 | 1.0 | 24 |
| Tomato___Bacterial_spot | 0.9846 | 0.9969 | 0.9907 | 320 |
| Tomato___Early_blight | 0.9866 | 0.9671 | 0.9767 | 152 |
| Tomato___Late_blight | 0.9759 | 0.993 | 0.9843 | 285 |
| Tomato___Leaf_Mold | 1.0 | 1.0 | 1.0 | 144 |
| Tomato___Septoria_leaf_spot | 0.9962 | 0.9962 | 0.9962 | 266 |
| Tomato___Spider_mites Two-spotted_spider_mite | 0.996 | 0.9881 | 0.992 | 252 |
| Tomato___Target_Spot | 0.9722 | 0.9953 | 0.9836 | 211 |
| Tomato___Tomato_Yellow_Leaf_Curl_Virus | 1.0 | 0.995 | 0.9975 | 804 |
| Tomato___Tomato_mosaic_virus | 1.0 | 1.0 | 1.0 | 56 |
| Tomato___healthy | 0.9958 | 1.0 | 0.9979 | 239 |

## near_ood

Leaves of 11 other PlantVillage crops (apple, grape, corn, ...). The model should not present findings for these.

- Images: 660
- flagged_unfamiliar_fraction: 0.5606
- would_show_finding_fraction: 0.0818
- energy_auroc_vs_controlled_test: 0.9216

## real_world

Held-out PlantDoc photos (30% of PlantDoc, near-duplicates grouped, never used for training, calibration or model selection). Different source, backgrounds and lighting.

- Images: 310
- accuracy: 0.5452
- macro_f1: 0.5474
- ece_calibrated: 0.2329
- abstention: {'accepted_fraction': 0.2161, 'accuracy_on_accepted': 0.791, 'flagged_unfamiliar_fraction': 0.2226}

| class | precision | recall | F1 | support |
|---|---|---|---|---|
| Pepper,_bell___Bacterial_spot | 0.625 | 0.4762 | 0.5405 | 21 |
| Pepper,_bell___healthy | 0.4783 | 0.6111 | 0.5366 | 18 |
| Potato___Early_blight | 0.4286 | 0.5 | 0.4615 | 30 |
| Potato___Late_blight | 0.4571 | 0.5714 | 0.5079 | 28 |
| Tomato___Bacterial_spot | 0.2593 | 0.2188 | 0.2373 | 32 |
| Tomato___Early_blight | 0.5 | 0.3913 | 0.439 | 23 |
| Tomato___Late_blight | 0.5758 | 0.6129 | 0.5938 | 31 |
| Tomato___Leaf_Mold | 0.7143 | 0.5556 | 0.625 | 27 |
| Tomato___Septoria_leaf_spot | 0.6429 | 0.6279 | 0.6353 | 43 |
| Tomato___Tomato_Yellow_Leaf_Curl_Virus | 0.76 | 0.8636 | 0.8085 | 22 |
| Tomato___Tomato_mosaic_virus | 0.5714 | 0.5 | 0.5333 | 16 |
| Tomato___healthy | 0.619 | 0.6842 | 0.65 | 19 |
