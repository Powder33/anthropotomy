# Anatomy assets and learning references

## BodyParts3D / Anatomography

**BodyParts3D, (c) The Database Center for Life Science licensed under CC
Attribution-Share Alike 2.1 Japan.**

Original attribution wording: “BodyParts3D, Copyrightc 2008 Life Science Integrated
Database Center licensed by CC Display-Inheritance 2.1 Japan”.

- Project: https://lifesciencedb.jp/bp3d/
- License: https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en
- Original license information: http://lifesciencedb.jp/bp3d/info_en/license/index.html
- Preserved license summary: https://github.com/Kevin-Mattheus-Moerman/BodyParts3D/blob/main/LICENSE_content
- Publication: Mitsuhashi N, et al. *BodyParts3D: 3D structure database for
  anatomical concepts.* Nucleic Acids Research 2009;37:D782–D785.
  https://doi.org/10.1093/nar/gkn613

The upstream model distribution used here identifies its BodyParts3D meshes under
CC BY-SA 2.1 Japan. We retain that license rather than relying on a newer license
reported by other distributors. All meshes with `source: "bp3d"` in the manifest,
including the skeleton, retain this attribution and license. Modified BP3D meshes
are distributed under the same license.

## Z-Anatomy

**Z-Anatomy by Gauthier Kervyn and contributors, CC BY-SA 4.0.**

- Project: https://www.z-anatomy.com/
- License: https://creativecommons.org/licenses/by-sa/4.0/

Meshes marked `source: "z-anatomy"` retain this attribution and license. These
supplement latissimus dorsi, rectus abdominis, internal oblique, transversus
abdominis and masseter. Modified Z-Anatomy meshes are distributed under CC BY-SA
4.0. Each mesh remains identifiable in the manifest; the binary is a collection
of independent meshes, not a newly fused anatomical surface.

## Browser-ready source and our adaptations

Source compilation: **Johan Bellander / BodyExplorer**.

- Repository: https://github.com/JohanBellander/BodyExplorer
- Pinned revision: `7d04bf3c4de2bd9cb234dd51d7e6857c099afafd`
- Source assets: `public/anatomy.glb`, `public/skeleton.glb`,
  `public/mesh_mapping.json`.
- Upstream credits: https://github.com/JohanBellander/BodyExplorer/blob/7d04bf3c4de2bd9cb234dd51d7e6857c099afafd/README.md#attribution

The upstream compilation decimates meshes and aligns the two datasets. This
project selects 127 muscle meshes for 45 learning entries, retains 201 skeletal
meshes, converts millimeters/Z-up to meters/Y-up, quantizes normals to signed
16-bit, and stores the independent buffers as gzip-compressed `.mesh` files.
No further geometric simplification is applied. Original mesh names, side, FMA
identifiers where supplied, and source identity are preserved in `manifest.json`.
Source downloads are verified with pinned SHA-256 checksums by
`scripts/prepare_models.py`.

This is a combined adult reference anatomy. Registration, anatomical coverage,
surface quality and individual body variation have limits. The reference does not
represent every muscle. “45” counts learning entries, including grouped structures
such as the erector spinae and rhomboids; it is not a count of all human muscles.
The application does not animate joint motion or simulate biomechanics.

## Learning content

Chinese introductions, action summaries and training associations are original
educational summaries. Attachment descriptions are abbreviated; exercises are
examples of muscle involvement, not claims of isolation or personalized plans.

Further reading: OpenStax, *Anatomy and Physiology 2e*, Chapter 11:
https://openstax.org/books/anatomy-and-physiology-2e/pages/11-introduction

The application code and original text are MIT licensed (see the repository
LICENSE). This does **not** relicense the anatomical assets. Third-party software
dependencies retain their own licenses. Preserve these credits and the relevant
mesh licenses when redistributing the anatomy assets or modified versions.
