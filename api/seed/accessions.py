"""Placeholder pieces for development and the pre-launch storefront. Every row is created with
`is_placeholder=True`, marked as a sample on the storefront, and removed by
`python manage.py purge_placeholders`.

Photos are not committed. Put JPEG, PNG or WebP files with the names below in `api/seed/media/`
before running `python manage.py seed_archive`."""

SEED_ACCESSIONS = [
    {
        "fields": {
            "title": "Green pique polo",
            "category": "polo",
            "brand": "Lacoste",
            "tagged_size": "L",
            "fit_note": "True to size, slightly long",
            "colour": "Green",
            "fabric_composition": "100% cotton",
            "era": "2000s",
            "condition_grade": "excellent",
            "measurements": {"chest": 55, "length": 72, "shoulder": 47, "sleeve": 22},
            "category_extras": {"knit_type": "pique", "collar_condition": "Flat, no curl"},
            "price_kes": 2800,
        },
        "photos": [("polo-front.jpg", "front"), ("polo-back.jpg", "back"), ("polo-tag.jpg", "tag")],
        "flaws": [],
    },
    {
        "fields": {
            "title": "Navy harrington jacket",
            "category": "jacket",
            "brand": "Ben Sherman",
            "tagged_size": "M",
            "fit_note": "Boxy, cropped at the waist",
            "colour": "Navy",
            "fabric_composition": "65% polyester, 35% cotton",
            "era": "1990s",
            "condition_grade": "good",
            "measurements": {"chest": 56, "length": 66, "shoulder": 46, "sleeve": 63},
            "category_extras": {"jacket_type": "harrington", "closure_condition": "Zip runs clean"},
            "price_kes": 4500,
        },
        "photos": [
            ("jacket-front.jpg", "front"),
            ("jacket-back.jpg", "back"),
            ("jacket-tag.jpg", "tag"),
            ("jacket-flaw.jpg", "flaw"),
        ],
        "flaws": [("Light mark inside the left cuff", "jacket-flaw.jpg")],
    },
    {
        "fields": {
            "title": "Oatmeal cable-knit crew",
            "category": "sweater",
            "brand": "Marks & Spencer",
            "tagged_size": "L",
            "fit_note": "Relaxed",
            "colour": "Oatmeal",
            "fabric_composition": "100% lambswool",
            "condition_grade": "excellent",
            "measurements": {"chest": 58, "length": 68, "shoulder": 50, "sleeve": 60},
            "category_extras": {"fibre": "wool", "pilling_level": "light", "neckline": "crew"},
            "price_kes": 3200,
        },
        "photos": [
            ("sweater-front.jpg", "front"),
            ("sweater-back.jpg", "back"),
            ("sweater-texture.jpg", "texture"),
        ],
        "flaws": [],
    },
    {
        "fields": {
            "title": "Grey pullover hoodie",
            "category": "hoodie",
            "brand": "Champion",
            "tagged_size": "XL",
            "fit_note": "Oversized",
            "colour": "Grey",
            "fabric_composition": "80% cotton, 20% polyester",
            "condition_grade": "worn_in",
            "measurements": {"chest": 62, "length": 72, "shoulder": 56, "sleeve": 62},
            "category_extras": {"style": "pullover", "hood_condition": "Drawstring intact"},
            "price_kes": 2500,
        },
        "photos": [
            ("hoodie-front.jpg", "front"),
            ("hoodie-back.jpg", "back"),
            ("hoodie-tag.jpg", "tag"),
            ("hoodie-flaw.jpg", "flaw"),
        ],
        "flaws": [("Cuffs faded from wear", "hoodie-flaw.jpg")],
    },
    {
        "fields": {
            "title": "Single-stitch graphic tee",
            "category": "tee",
            "brand": "Screen Stars",
            "tagged_size": "M",
            "fit_note": "Slim",
            "colour": "Black",
            "fabric_composition": "50% cotton, 50% polyester",
            "era": "1990s",
            "condition_grade": "good",
            "measurements": {"chest": 51, "length": 71, "shoulder": 46, "sleeve": 20},
            "category_extras": {"graphic": "graphic", "stitch": "single"},
            "price_kes": 1800,
        },
        "photos": [("tee-front.jpg", "front"), ("tee-back.jpg", "back"), ("tee-tag.jpg", "tag")],
        "flaws": [],
    },
]
