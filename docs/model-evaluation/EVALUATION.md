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

Independently collected photos (different source, backgrounds and lighting).

- Images: 1096
- accuracy: 0.3057
- macro_f1: 0.2743
- ece_calibrated: 0.4208
- abstention: {'accepted_fraction': 0.187, 'accuracy_on_accepted': 0.4195, 'flagged_unfamiliar_fraction': 0.7774}

| class | precision | recall | F1 | support |
|---|---|---|---|---|
| Pepper,_bell___Bacterial_spot | 0.5714 | 0.2817 | 0.3774 | 71 |
| Pepper,_bell___healthy | 0.3889 | 0.3443 | 0.3652 | 61 |
| Potato___Early_blight | 0.3205 | 0.2137 | 0.2564 | 117 |
| Potato___Late_blight | 0.3723 | 0.3333 | 0.3518 | 105 |
| Tomato___Bacterial_spot | 0.1667 | 0.0091 | 0.0172 | 110 |
| Tomato___Early_blight | 0.1755 | 0.6364 | 0.2752 | 88 |
| Tomato___Late_blight | 0.2667 | 0.6847 | 0.3838 | 111 |
| Tomato___Leaf_Mold | 0.381 | 0.0879 | 0.1429 | 91 |
| Tomato___Septoria_leaf_spot | 0.4603 | 0.3867 | 0.4203 | 150 |
| Tomato___Tomato_Yellow_Leaf_Curl_Virus | 0.7353 | 0.3333 | 0.4587 | 75 |
| Tomato___Tomato_mosaic_virus | 0.3333 | 0.037 | 0.0667 | 54 |
| Tomato___healthy | 0.2857 | 0.127 | 0.1758 | 63 |
