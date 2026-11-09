---
title: "UBL, CII ou Factur-X : les trois formats de la facture électronique comparés"
seoTitle: "UBL, CII ou Factur-X : quelle différence et quel format choisir ?"
description: "Les trois formats de la réforme comparés : XML pur (UBL, CII) ou hybride PDF + XML (Factur-X), lisibilité, Peppol. Lequel choisir selon votre cas."
keywords: ["ubl cii factur-x", "différence ubl cii", "format facture électronique", "ubl ou factur-x", "cii ou ubl", "formats socle réforme", "facture xml ubl", "factur-x vs ubl", "peppol ubl", "en 16931 syntaxe", "quel format facture électronique choisir"]
published: 2026-11-10
faq:
  - q: "Une plateforme agréée doit-elle accepter les trois formats ?"
    a: "<p>Oui : UBL, CII et Factur-X forment le socle commun de la réforme, que toutes les plateformes agréées doivent savoir recevoir. Elles peuvent ensuite convertir le format pour le transmettre au destinataire.</p>"
  - q: "Peut-on convertir une facture UBL en Factur-X ?"
    a: "<p>Les données, oui, puisque les deux suivent la même norme EN 16931. Mais un Factur-X a aussi besoin d’un PDF lisible : il faut donc générer une représentation visuelle de la facture en plus de convertir le XML.</p>"
---

La réforme française de la facture électronique ne retient pas un format, mais trois : **UBL**, **CII** et **Factur-X**. Toutes les plateformes agréées doivent savoir les recevoir. Les trois transportent les mêmes données, celles de la norme européenne EN 16931 ; ce qui change, c’est la forme.

## En une phrase chacun

- **UBL** : un fichier XML, au standard OASIS, très utilisé à l’international et dans le réseau Peppol.
- **CII** : un fichier XML, au standard des Nations unies (UN/CEFACT), historiquement plus utilisé en France et en Allemagne.
- **Factur-X** : un PDF lisible par un humain qui contient, en pièce jointe, un XML **CII**.

Factur-X n’est donc pas une troisième syntaxe : c’est un emballage hybride autour du CII.

## Le tableau comparatif

| | UBL | CII | Factur-X |
|---|---|---|---|
| Nature | XML seul | XML seul | PDF/A-3 + XML CII |
| Lisible sans logiciel | Non | Non | Oui (le PDF) |
| Norme d’origine | OASIS | UN/CEFACT | FNFE-MPE / FeRD (sur base CII) |
| Syntaxe EN 16931 | Oui | Oui | Oui (via le CII) |
| Réseau Peppol | Format natif | Accepté par certains | Rare |
| Taille | Légère | Légère | Plus lourde (PDF) |
| Avoir | Document distinct (`CreditNote`) | Même document, type 381 | Même document, type 381 |

## Ce qui change concrètement dans le XML

Les deux syntaxes nomment différemment les mêmes informations. Quelques exemples :

| Donnée (terme EN 16931) | UBL | CII |
|---|---|---|
| Numéro de facture (BT-1) | `cbc:ID` | `ram:ID` dans `ExchangedDocument` |
| Date d’émission (BT-2) | `cbc:IssueDate` au format `2026-11-09` | `udt:DateTimeString format="102"` au format `20261109` |
| Profil (BT-24) | `cbc:CustomizationID` | `GuidelineSpecifiedDocumentContextParameter` |
| Cadre de facturation (BT-23) | `cbc:ProfileID` | `BusinessProcessSpecifiedDocumentContextParameter` |
| Vendeur (BG-4) | `cac:AccountingSupplierParty` | `ram:SellerTradeParty` |
| Montant à payer (BT-115) | `cbc:PayableAmount` | `ram:DuePayableAmount` |
| Note avec code sujet | `cbc:Note` : `#PMT#texte` | `ram:IncludedNote` avec `ram:SubjectCode` |

Ces différences sont purement techniques : une facture correctement produite dans l’un ou l’autre format contient exactement les mêmes informations. Le [lecteur](/lire-facture-ubl/) du site le montre bien : une facture UBL et sa version CII s’affichent à l’identique.

## Lequel choisir ?

**Vous êtes une petite entreprise ou un indépendant** : Factur-X. Votre client peut ouvrir la facture même s’il n’est pas encore équipé, et vous gardez une facture qui ressemble à une facture. Le [générateur](/creer-facture-factur-x/) en produit une à partir d’un formulaire.

**Vous facturez des clients à l’étranger ou via Peppol** : UBL. C’est le format natif de Peppol, utilisé dans de nombreux pays européens pour la facturation des administrations et des entreprises.

**Vous développez une intégration entre logiciels** : celui que votre plateforme agréée et vos partenaires préfèrent. CII et UBL se valent techniquement ; le choix dépend surtout de l’écosystème.

Dans tous les cas, ce n’est pas une décision définitive : la plateforme agréée peut convertir un format dans un autre au moment de la transmission.

## Les profils, une notion commune

Les profils (MINIMUM, BASIC, EN 16931, EXTENDED…) existent surtout dans le monde Factur-X et ZUGFeRD. En UBL, on parle plutôt de **spécifications d’usage** (CIUS) : Peppol BIS Billing 3.0, XRechnung, ou la CIUS française. Toutes restent compatibles avec la norme EN 16931. Le détail des profils Factur-X est dans [le guide des profils](/guides/profils-factur-x/).
