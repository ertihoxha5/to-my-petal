"""Curated notes triggered by what the user told us (watering, light, timing).

These come from the care guide, never from the image model, and are labelled as
such in the API (`source: "care_guide"`).
"""

from __future__ import annotations

from typing import Literal

SymptomsStarted = Literal["today", "this_week", "few_weeks", "longer", "not_sure"]
Watering = Literal["daily", "every_few_days", "weekly", "less_often", "not_sure"]
Light = Literal["full_sun", "partial_sun", "bright_indirect", "low_light", "not_sure"]

OUTDOOR_VEG = {"tomato", "potato", "pepper_bell"}


def context_notes(
    species_key: str,
    symptoms_started: str | None,
    watering: str | None,
    light: str | None,
    recent_changes: str,
) -> list[dict[str, str | None]]:
    notes: list[dict[str, str | None]] = []

    def add(text: str, slug: str | None) -> None:
        notes.append({"text": text, "guide_slug": slug, "source": "care_guide"})

    if watering == "daily" and species_key in OUTDOOR_VEG | {"basil"}:
        add(
            "You water often. Many leaf-spot diseases spread on wet leaves, so water at the base of the "
            "plant, ideally in the morning, rather than over the foliage.",
            {
                "tomato": "tomato-care",
                "potato": "potato-care",
                "pepper_bell": "bell-pepper-care",
            }.get(species_key, "basil-care"),
        )
    if watering == "daily" and species_key == "monstera":
        add(
            "Monstera prefers the top quarter to third of its soil to dry before the next watering.",
            "monstera-care",
        )
    if light == "low_light" and species_key in OUTDOOR_VEG:
        add(
            "Tomatoes, potatoes and peppers need plenty of light; low light leads to weak, spindly growth.",
            "tomato-care" if species_key == "tomato" else None,
        )
    if light == "low_light" and species_key == "basil":
        add("Basil grows best with at least about six hours of direct sun a day.", "basil-care")
    if light == "full_sun" and species_key == "monstera":
        add("Monstera likes bright light but can scorch in harsh direct sun.", "monstera-care")
    if symptoms_started in ("today", "this_week"):
        add(
            "These changes are recent. A follow-up photo from the same angle in about a week will help you "
            "see whether marks are spreading.",
            None,
        )
    if recent_changes.strip():
        add(
            "You mentioned recent changes. Moving, repotting or sudden temperature changes can stress a "
            "plant, and stress can change how leaves look without any disease involved.",
            None,
        )
    return notes
