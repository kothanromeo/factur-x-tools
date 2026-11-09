<div align="center">

# Factur-X Tools

**Lire, valider et créer des factures électroniques Factur-X, sans rien envoyer à un serveur.**

[**→ Ouvrir l'outil**](https://factur-x-tools.kothanromeo.dev/) · [Guides](https://factur-x-tools.kothanromeo.dev/guides/) · [Signaler un problème](https://github.com/kothanromeo/factur-x-tools/issues)

![Tests](https://github.com/kothanromeo/factur-x-tools/actions/workflows/ci.yml/badge.svg)
![Licence MIT](https://img.shields.io/badge/licence-MIT-blue)
![Factur-X EN 16931](https://img.shields.io/badge/Factur--X-EN%2016931-0b5c8c)

</div>

---

Depuis le 1er septembre 2026, toutes les entreprises françaises doivent pouvoir recevoir des factures électroniques, et les PME et micro-entreprises devront les émettre à partir de septembre 2027. Factur-X est l'un des trois formats acceptés : un PDF lisible par un humain, qui embarque un XML structuré pour les logiciels.

Le problème : la plupart des lecteurs PDF n'affichent pas le XML, et les outils en ligne pour l'ouvrir demandent un compte ou envoient vos factures sur leur serveur. **Factur-X Tools fait tout dans le navigateur.** Le site est statique : il n'a aucun moyen technique de recevoir vos fichiers.

## Fonctionnalités

| Outil | Ce qu'il fait |
|---|---|
| **[Lecteur](https://factur-x-tools.kothanromeo.dev/lire-facture-factur-x/)** | Extrait le `factur-x.xml` d'un PDF (ou lit un XML CII seul) et l'affiche comme une facture : parties, lignes, TVA, totaux, paiement, notes. |
| **[Validateur](https://factur-x-tools.kothanromeo.dev/valider-factur-x/)** | Une quarantaine de contrôles : conteneur PDF/A-3 et XMP, règles métier EN 16931 (BR-xx, BR-CO-xx), recalcul des totaux et de la TVA, SIREN (clé de Luhn), nouvelles mentions françaises de 2026. |
| **[Générateur](https://factur-x-tools.kothanromeo.dev/creer-facture-factur-x/)** | Produit un Factur-X **EN 16931** à partir d'un formulaire : soit un PDF généré (police incorporée), soit **votre propre PDF** auquel on ajoute le XML, les métadonnées et l'OutputIntent. Gère la franchise en base (art. 293 B du CGI) et la TVA sur les débits. |

Formats reconnus : Factur-X 1.0x, ZUGFeRD 2.x, XRechnung (CII). Profils MINIMUM, BASIC WL, BASIC, EN 16931, EXTENDED.

## Comment ça marche

```
src/lib/facturx/
├── parse.ts      XML CII → objet Invoice (navigation par nom local, indépendante des préfixes)
├── build.ts      Formulaire → XML CII EN 16931 (ordre des éléments conforme au XSD)
├── validate.ts   Règles EN 16931 + exigences françaises (SIREN, BT-23, notes PMT/PMD/AAB)
├── pdf.ts        Lecture/écriture des pièces jointes (/EmbeddedFiles + /AF), XMP, OutputIntent
├── xmp.ts        Métadonnées PDF/A-3B + schéma d'extension Factur-X (fx:)
├── icc.ts        Profil ICC sRGB généré à la volée (pas de binaire tiers dans le dépôt)
└── render.ts     Rendu A4 de la facture avec pdf-lib + police Inter incorporée
```

- **[pdf-lib](https://pdf-lib.js.org/)** pour lire et écrire les PDF, chargé uniquement à la demande.
- **[Astro](https://astro.build/)** pour le site statique (pages d'outils + guides en Markdown, sitemap, RSS, données structurées JSON-LD).
- Aucun framework côté client : TypeScript natif, environ 40 Ko de JS au premier chargement.

### Vérifications

- Tests unitaires et d'intégration avec Vitest : calculs, aller-retour XML, génération puis relecture d'un PDF, remplacement d'un XML existant.
- Le XML généré est validé contre le **schéma XSD officiel Factur-X (profil EN 16931)** à l'aide de la bibliothèque de référence [factur-x](https://github.com/akretion/factur-x) (Akretion).

> ⚠️ Le validateur du site n'exécute pas l'intégralité des règles Schematron officielles et ne fait pas une validation PDF/A complète (veraPDF). Il couvre les règles qui expliquent la majorité des rejets. Pour une certification, utilisez en complément le validateur de votre plateforme agréée.

## Développement

```bash
npm install
npm run dev        # http://localhost:4321/
npm test           # tests Vitest
npm run build      # site statique dans dist/
```

Le site est publié sur GitHub Pages avec le domaine `factur-x-tools.kothanromeo.dev`. Pour le servir ailleurs, par exemple dans un sous-dossier :

```bash
SITE_URL=https://exemple.fr SITE_BASE=/factur-x-tools npm run build
```

L'image de partage (`public/og.png`) se régénère avec `node scripts/og-image.mjs`.

## Contribuer

Les issues et pull requests sont les bienvenues, en particulier :

- des fichiers Factur-X réels qui sont mal lus (**anonymisez-les** avant de les partager) ;
- des règles EN 16931 supplémentaires dans `validate.ts` ;
- la lecture des factures UBL.

## Licence

[MIT](LICENSE) © Roméo Kothan
