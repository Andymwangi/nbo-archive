"""Normalise uploaded photographs before they are stored.

Every upload is decoded and re-encoded as JPEG, which drops EXIF (camera serials, GPS) and any
other embedded metadata. Orientation is applied to the pixels first so the photo still reads the
right way up. Photos tagged with a colour profile (an iPhone's Display P3, a CMYK scan) are
converted to sRGB, since the stored file carries no profile and browsers read untagged pixels as
sRGB. Resizing for display is left to next/image; the stored file is capped at a sensible master
size."""

import base64
import io
from dataclasses import dataclass

from django.core.files.base import ContentFile
from PIL import Image, ImageCms, ImageOps, UnidentifiedImageError

ACCEPTED_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_LONG_EDGE = 2400
MAX_PIXELS = 50_000_000
JPEG_QUALITY = 85
PLACEHOLDER_EDGE = 16
PROFILE_MODES = {"RGB", "RGBA", "CMYK"}

_SRGB = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB"))


class InvalidImage(ValueError):
    pass


@dataclass(frozen=True)
class ProcessedImage:
    content: ContentFile
    width: int
    height: int
    placeholder: str


def _flatten(image: Image.Image) -> Image.Image:
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, (255, 255, 255))
        background.paste(rgba, mask=rgba.getchannel("A"))
        return background
    return image.convert("RGB")


def _to_srgb(image: Image.Image, icc_profile: bytes | None) -> Image.Image:
    if not icc_profile or image.mode not in PROFILE_MODES:
        return image
    try:
        source = ImageCms.ImageCmsProfile(io.BytesIO(icc_profile))
        return ImageCms.profileToProfile(
            image, source, _SRGB, outputMode="RGBA" if image.mode == "RGBA" else "RGB"
        )
    except (ImageCms.PyCMSError, OSError, ValueError):
        # A damaged or mismatched profile is ignored rather than rejecting the photo.
        return image


def _placeholder(image: Image.Image) -> str:
    small = image.copy()
    small.thumbnail((PLACEHOLDER_EDGE, PLACEHOLDER_EDGE), Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    small.save(buffer, format="JPEG", quality=60)
    return "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def process_upload(upload) -> ProcessedImage:
    if upload.size > MAX_UPLOAD_BYTES:
        raise InvalidImage("Photos must be 15 MB or smaller.")

    try:
        upload.seek(0)
        with Image.open(upload) as probe:
            if probe.format not in ACCEPTED_FORMATS:
                raise InvalidImage("Upload a JPEG, PNG or WebP photo.")
            if probe.width * probe.height > MAX_PIXELS:
                raise InvalidImage("This photo is too large to process.")
            probe.verify()

        upload.seek(0)
        with Image.open(upload) as source:
            source.load()
            icc_profile = source.info.get("icc_profile")
            image = _flatten(_to_srgb(ImageOps.exif_transpose(source), icc_profile))
    except InvalidImage:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, SyntaxError) as exc:
        raise InvalidImage("This file is not a readable photo.") from exc

    image.thumbnail((MAX_LONG_EDGE, MAX_LONG_EDGE), Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    return ProcessedImage(
        content=ContentFile(buffer.getvalue(), name="photo.jpg"),
        width=image.width,
        height=image.height,
        placeholder=_placeholder(image),
    )
