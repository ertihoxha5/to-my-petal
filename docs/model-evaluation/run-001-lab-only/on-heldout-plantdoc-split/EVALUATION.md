# Evaluation: pv15-mobilenetv3large-20261006-36d40ae8

## controlled_test

PlantVillage leaf-grouped test split. Lab-style photos of single leaves on plain backgrounds; NOT representative of photos taken in a garden or home.

- Images: 3434
- accuracy: 0.995
- macro_f1: 0.9947
- ece_calibrated: 0.0051
- abstention: {'accepted_fraction': 0.9732, 'accuracy_on_accepted': 0.9997, 'flagged_unfamiliar_fraction': 0.0213}

| class | precision | recall | F1 | support |
|---|---|---|---|---|
| Pepper,_bell___Bacterial_spot | 1.0 | 1.0 | 1.0 | 154 |
| Pepper,_bell___healthy | 1.0 | 1.0 | 1.0 | 223 |
| Potato___Early_blight | 1.0 | 0.9868 | 0.9934 | 152 |
| Potato___Late_blight | 0.9867 | 0.9737 | 0.9801 | 152 |
| Potato___healthy | 1.0 | 1.0 | 1.0 | 24 |
| Tomato___Bacterial_spot | 0.9938 | 0.9938 | 0.9938 | 320 |
| Tomato___Early_blight | 0.9933 | 0.9737 | 0.9834 | 152 |
| Tomato___Late_blight | 0.9759 | 0.993 | 0.9843 | 285 |
| Tomato___Leaf_Mold | 1.0 | 1.0 | 1.0 | 144 |
| Tomato___Septoria_leaf_spot | 0.9925 | 1.0 | 0.9963 | 266 |
| Tomato___Spider_mites Two-spotted_spider_mite | 1.0 | 0.996 | 0.998 | 252 |
| Tomato___Target_Spot | 0.986 | 1.0 | 0.9929 | 211 |
| Tomato___Tomato_Yellow_Leaf_Curl_Virus | 1.0 | 0.9975 | 0.9988 | 804 |
| Tomato___Tomato_mosaic_virus | 1.0 | 1.0 | 1.0 | 56 |
| Tomato___healthy | 1.0 | 1.0 | 1.0 | 239 |

## near_ood

Leaves of 11 other PlantVillage crops (apple, grape, corn, ...). The model should not present findings for these.

- Images: 660
- flagged_unfamiliar_fraction: 0.8015
- would_show_finding_fraction: 0.1788
- energy_auroc_vs_controlled_test: 0.9725

## real_world

Held-out PlantDoc photos (30% of PlantDoc, near-duplicates grouped, never used for training, calibration or model selection). Different source, backgrounds and lighting.

- Images: 310
- accuracy: 0.3129
- macro_f1: 0.282
- ece_calibrated: 0.4167
- abstention: {'accepted_fraction': 0.2, 'accuracy_on_accepted': 0.371, 'flagged_unfamiliar_fraction': 0.7839}

| class | precision | recall | F1 | support |
|---|---|---|---|---|
| Pepper,_bell___Bacterial_spot | 0.4545 | 0.2381 | 0.3125 | 21 |
| Pepper,_bell___healthy | 0.5 | 0.3889 | 0.4375 | 18 |
| Potato___Early_blight | 0.4091 | 0.3 | 0.3462 | 30 |
| Potato___Late_blight | 0.2963 | 0.2857 | 0.2909 | 28 |
| Tomato___Bacterial_spot | 0.0 | 0.0 | 0.0 | 32 |
| Tomato___Early_blight | 0.1477 | 0.5652 | 0.2342 | 23 |
| Tomato___Late_blight | 0.2791 | 0.7742 | 0.4103 | 31 |
| Tomato___Leaf_Mold | 0.375 | 0.1111 | 0.1714 | 27 |
| Tomato___Septoria_leaf_spot | 0.4848 | 0.3721 | 0.4211 | 43 |
| Tomato___Tomato_Yellow_Leaf_Curl_Virus | 0.75 | 0.4091 | 0.5294 | 22 |
| Tomato___Tomato_mosaic_virus | 0.0 | 0.0 | 0.0 | 16 |
| Tomato___healthy | 0.4286 | 0.1579 | 0.2308 | 19 |
