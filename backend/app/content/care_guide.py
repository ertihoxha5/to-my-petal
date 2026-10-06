"""Curated care guide.

Editorial rules:
  * Every article cites the extension-service pages it summarises; the dates shown are
    the dates stated by those pages ("not stated" when a page shows none).
  * `reviewed_on` is when this summary was last checked against its sources.
  * Only cultural, non-chemical practices are summarised. Products, doses and spray
    schedules are deliberately left out; readers are pointed to the source and their
    local extension service instead.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

REVIEWED_ON = "2026-10-06"
REVIEWED_BY = "to my petal maintainers (summaries of extension publications; not reviewed by a plant pathologist)"

TREATMENT_NOTE = (
    "We don't give pesticide or fungicide instructions. If you are considering a product, read its "
    "label and ask your local extension service or a plant clinic what is appropriate where you live."
)


@dataclass(frozen=True)
class Source:
    title: str
    publisher: str
    url: str
    source_date: str  # as stated by the source


@dataclass(frozen=True)
class Article:
    slug: str
    kind: str  # "plant" | "condition"
    title: str
    plants: list[str]
    summary: str
    looks_like: list[str]
    care: list[str]
    often_confused_with: list[str]
    get_help_when: str
    sources: list[Source]
    classifier_label: bool = False  # True when the image model was trained on this condition
    reviewed_on: str = REVIEWED_ON
    reviewed_by: str = REVIEWED_BY
    treatment_note: str = TREATMENT_NOTE
    tags: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return asdict(self)


CLEMSON_TOMATO_DISEASES = Source(
    "Tomato Diseases & Disorders",
    "Clemson Cooperative Extension, Home & Garden Information Center",
    "https://hgic.clemson.edu/factsheet/tomato-diseases-disorders/",
    "Updated July 11, 2025",
)
CLEMSON_POTATO_DISEASES = Source(
    "Irish Potato & Sweetpotato Diseases",
    "Clemson Cooperative Extension, Home & Garden Information Center",
    "https://hgic.clemson.edu/factsheet/irish-sweet-potato-diseases/",
    "Updated July 18, 2025",
)
NCSU_EARLY_BLIGHT = Source(
    "Early Blight of Tomato",
    "NC State Extension",
    "https://content.ces.ncsu.edu/early-blight-of-tomato",
    "Not stated on our last check",
)
NCSU_SEPTORIA = Source(
    "Septoria Leaf Spot of Tomato",
    "NC State Extension",
    "https://content.ces.ncsu.edu/septoria-leaf-spot-of-tomato",
    "Not stated on our last check",
)
NCSU_BACTERIAL_SPOT = Source(
    "Bacterial Spot of Pepper and Tomato",
    "NC State Extension",
    "https://content.ces.ncsu.edu/bacterial-spot-of-pepper-and-tomato",
    "February 14, 2019",
)
NCSU_TYLCV = Source(
    "Tomato Yellow Leaf Curl Virus",
    "NC State Extension",
    "https://content.ces.ncsu.edu/tomato-yellow-leaf-curl-virus",
    "July 14, 2023",
)
UF_TARGET_SPOT = Source(
    "Target Spot of Tomato in Florida (PP351)",
    "UF/IFAS Extension (EDIS)",
    "https://edis.ifas.ufl.edu/publication/PP351",
    "Not stated on our last check",
)
UCIPM_SPIDER_MITES = Source(
    "Spider Mites: Pest Notes",
    "University of California Statewide IPM Program",
    "https://ipm.ucanr.edu/home-and-landscape/spider-mites/",
    "Updated December 2011",
)
UCIPM_TMV = Source(
    "Tobacco Mosaic Virus (Home and Landscape)",
    "University of California Statewide IPM Program",
    "https://ipm.ucanr.edu/home-and-landscape/tobacco-mosaic-virus/",
    "Not stated on our last check",
)

ARTICLES: list[Article] = [
    # ---- Plants ---------------------------------------------------------------
    Article(
        slug="tomato-care",
        kind="plant",
        title="Tomato",
        plants=["tomato"],
        summary="A warm-season plant that likes plenty of light, steady moisture and good air flow. "
        "Most leaf diseases are easier to prevent than to fix, so spacing and dry leaves matter.",
        looks_like=[],
        care=[
            "Give it as much light as you can; low light makes tomatoes tall and spindly.",
            "Grow in well-drained soil and keep moisture steady rather than alternating soaked and dry.",
            "Water the soil, not the leaves. Drip lines or a watering can at the base keep foliage dry.",
            "Space plants so their leaves don't touch, and stake or cage them to keep leaves and fruit off the soil.",
            "Mulch around the base to reduce soil splashing onto lower leaves.",
            "Remove suckers on staked plants and keep the area free of weeds and fallen leaves.",
        ],
        often_confused_with=[],
        get_help_when="Many plants show spreading spots, or leaves are dying faster than new ones grow.",
        sources=[
            Source(
                "Tomato",
                "Clemson Cooperative Extension, Home & Garden Information Center",
                "https://hgic.clemson.edu/factsheet/tomato/",
                "Updated March 2, 2022",
            ),
            CLEMSON_TOMATO_DISEASES,
        ],
        tags=["vegetable", "outdoor", "supported by image model"],
    ),
    Article(
        slug="potato-care",
        kind="plant",
        title="Potato",
        plants=["potato"],
        summary="Grown from certified seed tubers in sunny beds. Healthy foliage depends on dry leaves, "
        "rotation and removing volunteer plants.",
        looks_like=[],
        care=[
            "Start from certified disease-free seed potatoes rather than saved or supermarket tubers.",
            "Water steadily, especially from flowering onwards; mulch helps keep moisture even.",
            "Hill soil up around the stems so tubers stay covered; light turns them green.",
            "Rotate where you grow potatoes and tomatoes, and remove volunteer potato plants.",
            "Water early in the day and avoid overhead watering in the evening.",
        ],
        often_confused_with=[],
        get_help_when="Dark, water-soaked patches appear and spread quickly in cool, wet weather.",
        sources=[
            Source(
                "Potato",
                "Clemson Cooperative Extension, Home & Garden Information Center",
                "https://hgic.clemson.edu/factsheet/potato/",
                "Updated October 26, 2021",
            ),
            CLEMSON_POTATO_DISEASES,
        ],
        tags=["vegetable", "outdoor", "supported by image model"],
    ),
    Article(
        slug="bell-pepper-care",
        kind="plant",
        title="Bell pepper",
        plants=["pepper_bell"],
        summary="A warm-season plant that dislikes cold and uneven watering. The image model covers bell "
        "peppers only, not chilli peppers.",
        looks_like=[],
        care=[
            "Plant out only after the last frost; peppers grow best with warm days and mild nights.",
            "Keep soil evenly moist, especially while fruit is forming; water deeply rather than often.",
            "Mulch to hold moisture steady and reduce weeds.",
            "Avoid handling or tying plants while leaves are wet.",
        ],
        often_confused_with=[],
        get_help_when="Many leaves develop small dark spots and begin to drop.",
        sources=[
            Source(
                "Pepper",
                "Clemson Cooperative Extension, Home & Garden Information Center",
                "https://hgic.clemson.edu/factsheet/pepper/",
                "Updated January 24, 2023",
            ),
            NCSU_BACTERIAL_SPOT,
        ],
        tags=["vegetable", "outdoor", "supported by image model"],
    ),
    Article(
        slug="basil-care",
        kind="plant",
        title="Basil",
        plants=["basil"],
        summary="A tender herb that wants warmth and sun. You can journal basil, but the image model has "
        "not been trained on it and will not analyse basil photos.",
        looks_like=[],
        care=[
            "Give it full sun, or at least about six hours of direct sun a day.",
            "Keep moisture steady and water at the soil rather than over the leaves.",
            "Pinch off flower buds to keep leaves coming.",
            "Keep it warm: cold nights below about 50 °F (10 °C) set it back.",
            "Space plants for air flow; downy mildew is common in humid summers.",
        ],
        often_confused_with=[],
        get_help_when="Leaves yellow with grey-purple fuzz underneath and it spreads across plants.",
        sources=[
            Source(
                "Basil",
                "Clemson Cooperative Extension, Home & Garden Information Center",
                "https://hgic.clemson.edu/factsheet/basil/",
                "Updated May 1, 2019",
            ),
        ],
        tags=["herb", "not supported by image model"],
    ),
    Article(
        slug="monstera-care",
        kind="plant",
        title="Monstera",
        plants=["monstera"],
        summary="A tropical houseplant that likes bright, indirect light and a little drying between "
        "waterings. Journal only: the image model does not cover Monstera.",
        looks_like=[],
        care=[
            "Place in bright light, but out of harsh direct sun.",
            "Water thoroughly, then let the top quarter to third of the soil dry before watering again.",
            "Use a well-draining, rich potting mix.",
            "It enjoys humidity; a humidifier or pebble tray can help in dry rooms.",
            "Wipe dust from the leaves now and then, and give tall plants a sturdy support.",
            "Its sap contains calcium oxalate crystals: keep it away from pets and children who might chew it.",
        ],
        often_confused_with=[],
        get_help_when="Stems turn soft and dark at the soil line, which can point to root problems.",
        sources=[
            Source(
                "Monstera deliciosa",
                "NC State Extension Gardener Plant Toolbox",
                "https://plants.ces.ncsu.edu/plants/monstera-deliciosa/",
                "Not stated on our last check",
            ),
        ],
        tags=["houseplant", "not supported by image model"],
    ),
    # ---- Conditions -----------------------------------------------------------
    Article(
        slug="early-blight",
        kind="condition",
        title="Early blight",
        plants=["tomato", "potato"],
        summary="A common fungal leaf disease of tomato and potato that usually starts on older, lower leaves.",
        looks_like=[
            "Small brown spots on older leaves that grow into rings, like a target.",
            "Yellowing tissue around the spots; badly affected leaves drop.",
        ],
        care=[
            "Remove affected lower leaves and keep fallen leaves off the soil.",
            "Water at the soil, not over the leaves, and mulch to stop soil splashing up.",
            "Space and stake plants so leaves dry quickly and don't touch.",
            "Rotate tomatoes and potatoes to a different bed in later years and remove volunteer plants.",
            "Choose resistant or tolerant varieties next season.",
        ],
        often_confused_with=[
            "Septoria leaf spot (smaller, more numerous spots)",
            "Target spot",
            "Natural yellowing of old lower leaves",
        ],
        get_help_when="Spots move up the plant quickly or many plants are affected.",
        sources=[CLEMSON_TOMATO_DISEASES, NCSU_EARLY_BLIGHT, CLEMSON_POTATO_DISEASES],
        classifier_label=True,
    ),
    Article(
        slug="late-blight",
        kind="condition",
        title="Late blight",
        plants=["tomato", "potato"],
        summary="A fast-moving disease of tomato and potato, favoured by cool, wet weather. It can spread "
        "between gardens, so act quickly if you suspect it.",
        looks_like=[
            "Dark, water-soaked patches, often on younger leaves, that enlarge quickly.",
            "Pale or white growth on the underside of affected leaves in damp weather.",
            "Leaves browning and shrivelling within days.",
        ],
        care=[
            "Check plants daily in cool, wet spells.",
            "Remove and bag affected leaves or whole plants rather than composting them.",
            "Keep foliage dry: water in the morning at soil level and allow extra spacing.",
            "Remove volunteer tomato and potato plants; use certified seed potatoes and healthy transplants.",
        ],
        often_confused_with=[
            "Early blight (slower, ringed spots on older leaves)",
            "Frost or cold damage",
        ],
        get_help_when="You suspect late blight at all. Local extension services often want to know, "
        "because it affects neighbouring gardens and farms.",
        sources=[CLEMSON_TOMATO_DISEASES, CLEMSON_POTATO_DISEASES],
        classifier_label=True,
    ),
    Article(
        slug="septoria-leaf-spot",
        kind="condition",
        title="Septoria leaf spot",
        plants=["tomato"],
        summary="A fungal disease of tomato leaves that thrives in mild, rainy weather.",
        looks_like=[
            "Many small round spots with dark edges and pale beige centres, starting on lower leaves.",
            "Tiny black specks inside the spots (best seen with a magnifier).",
        ],
        care=[
            "Remove spotted lower leaves and clear plant debris at the end of the season.",
            "Avoid overhead watering and space plants for air flow.",
            "Rotate tomatoes to a different spot for about three years.",
        ],
        often_confused_with=["Early blight (larger, ringed spots)", "Bacterial spot"],
        get_help_when="Spots spread up most of the plant despite removing affected leaves.",
        sources=[CLEMSON_TOMATO_DISEASES, NCSU_SEPTORIA],
        classifier_label=True,
    ),
    Article(
        slug="tomato-leaf-mold",
        kind="condition",
        title="Leaf mold",
        plants=["tomato"],
        summary="A fungal disease mostly seen where air is humid and still, such as greenhouses and dense plantings.",
        looks_like=[
            "Pale yellow patches on the upper side of leaves.",
            "Olive-green to grey velvety growth on the underside beneath those patches.",
        ],
        care=[
            "Improve air flow: space, stake and prune plants; ventilate greenhouses.",
            "Avoid wetting leaves when watering.",
            "Remove affected leaves and clear plant residue after harvest.",
        ],
        often_confused_with=[
            "Nutrient-related yellowing",
            "Late blight (darker, water-soaked patches)",
        ],
        get_help_when="It keeps returning in a greenhouse or tunnel despite better ventilation.",
        sources=[CLEMSON_TOMATO_DISEASES],
        classifier_label=True,
    ),
    Article(
        slug="bacterial-spot",
        kind="condition",
        title="Bacterial spot",
        plants=["tomato", "pepper_bell"],
        summary="A bacterial disease of tomato and pepper, favoured by warm, wet weather and spread by "
        "splashing water, hands and tools.",
        looks_like=[
            "Small (usually under 3 mm) dark, water-soaked spots, sometimes with a yellow halo.",
            "Spot centres that dry out and tear; pepper leaves may drop early.",
        ],
        care=[
            "Start with certified disease-free seed and healthy transplants.",
            "Avoid overhead watering, and don't tie, harvest or handle plants while they are wet.",
            "Remove and dispose of affected plant material; clean tools and trays.",
            "Don't replant tomatoes or peppers in the same spot the next year; remove nightshade-family weeds.",
        ],
        often_confused_with=["Septoria leaf spot", "Early blight", "Bacterial speck"],
        get_help_when="Many plants are affected or fruit is spotting.",
        sources=[NCSU_BACTERIAL_SPOT, CLEMSON_TOMATO_DISEASES],
        classifier_label=True,
    ),
    Article(
        slug="target-spot",
        kind="condition",
        title="Target spot",
        plants=["tomato"],
        summary="A fungal disease favoured by warm, humid weather and long periods of wet leaves.",
        looks_like=[
            "Pinpoint dark spots that grow into light brown or grey centres with darker rings.",
            "Diffuse yellowing around spots; spots may merge and leaves drop early.",
        ],
        care=[
            "Rotate tomatoes with plants outside the nightshade family.",
            "Use clean, disease-free transplants.",
            "Remove weeds, volunteer plants and diseased debris, especially between seasons.",
            "Help leaves dry quickly with spacing and watering at soil level.",
        ],
        often_confused_with=["Early blight", "Septoria leaf spot"],
        get_help_when="Spots spread quickly during hot, humid weather.",
        sources=[UF_TARGET_SPOT],
        classifier_label=True,
    ),
    Article(
        slug="spider-mites",
        kind="condition",
        title="Spider mites",
        plants=["tomato"],
        summary="Tiny sap-feeding mites that thrive in hot, dry and dusty conditions, often on water-stressed plants.",
        looks_like=[
            "Fine pale speckles (stippling) on leaves, sometimes a bronze tint.",
            "Very fine webbing; leaves may yellow and drop.",
        ],
        care=[
            "Keep plants well watered so they are not stressed.",
            "Hose off leaf undersides with a strong spray of water.",
            "Damp down dusty paths nearby.",
            "Protect natural predators (predatory mites, lacewings, minute pirate bugs) by avoiding "
            "broad-spectrum insecticides, which often make mite problems worse.",
        ],
        often_confused_with=["Nutrient deficiency", "Sun or heat stress"],
        get_help_when="Webbing covers growing tips despite regular water sprays.",
        sources=[UCIPM_SPIDER_MITES],
        classifier_label=True,
    ),
    Article(
        slug="tomato-yellow-leaf-curl",
        kind="condition",
        title="Tomato yellow leaf curl virus",
        plants=["tomato"],
        summary="A virus spread by whiteflies. There is no cure for an infected plant; prevention focuses on "
        "whiteflies and removing infected plants.",
        looks_like=[
            "Leaves curling upward, with yellow edges and between the veins.",
            "Small, crumpled new leaves, stunted bushy plants and flowers dropping.",
        ],
        care=[
            "Choose resistant varieties.",
            "Remove plants with early symptoms promptly, bagging them so whiteflies don't move on.",
            "Keep weeds down in and around the garden.",
            "Reflective mulches can help keep whiteflies away from young plants.",
        ],
        often_confused_with=["Heat or herbicide damage", "Other leaf curl causes"],
        get_help_when="You see curling and yellowing together with whiteflies on several plants.",
        sources=[NCSU_TYLCV, CLEMSON_TOMATO_DISEASES],
        classifier_label=True,
    ),
    Article(
        slug="tomato-mosaic",
        kind="condition",
        title="Mosaic viruses",
        plants=["tomato"],
        summary="Tomato mosaic and the closely related tobacco mosaic virus cause mottled leaves. The model's "
        'label is "tomato mosaic virus"; our source covers tobacco mosaic, managed the same way. There is no cure.',
        looks_like=[
            "Light and dark green (or yellow) mottling on leaves.",
            "Distorted, narrow, 'shoestring'-like leaflets.",
        ],
        care=[
            "Remove and dispose of affected plants.",
            "Wash hands and tools between plants; the virus spreads by touch.",
            "Don't smoke or handle tobacco around plants.",
            "Control weeds and choose resistant varieties next time.",
        ],
        often_confused_with=["Nutrient deficiencies", "Herbicide drift"],
        get_help_when="Several plants show mottling and distortion.",
        sources=[UCIPM_TMV, CLEMSON_TOMATO_DISEASES],
        classifier_label=True,
    ),
]

BY_SLUG = {a.slug: a for a in ARTICLES}


def search(query: str = "", plant: str | None = None, kind: str | None = None) -> list[Article]:
    q = query.strip().lower()
    out = []
    for a in ARTICLES:
        if plant and plant not in a.plants:
            continue
        if kind and a.kind != kind:
            continue
        if q:
            hay = " ".join(
                [a.title, a.summary, *a.looks_like, *a.care, *a.often_confused_with, *a.tags]
            ).lower()
            if not all(word in hay for word in q.split()):
                continue
        out.append(a)
    return out
