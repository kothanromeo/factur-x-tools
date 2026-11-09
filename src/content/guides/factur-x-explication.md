---
title: "Factur-X, c’est quoi exactement ? Ce qu’il y a dans le fichier"
seoTitle: "Factur-X : définition simple et ce que contient vraiment le fichier"
description: "Factur-X expliqué sans jargon : un PDF lisible, un XML caché, PDF/A-3, CII et profils. Ce qui le distingue d’un PDF classique."
published: 2026-11-09
faq:
  - q: "Factur-X est-il obligatoire ?"
    a: "<p>Non, pas en tant que tel. Ce qui est obligatoire, c’est d’émettre et de recevoir des factures électroniques structurées. La réforme accepte trois formats : Factur-X, UBL et CII. Factur-X est souvent le plus simple pour une petite entreprise, parce que la facture reste lisible par un humain.</p>"
  - q: "Un PDF signé électroniquement est-il un Factur-X ?"
    a: "<p>Non. La signature garantit l’origine et l’intégrité du document, mais elle n’ajoute aucune donnée structurée. Sans le fichier XML en pièce jointe, ce n’est pas un Factur-X.</p>"
  - q: "Qui maintient le format ?"
    a: "<p>Le FNFE-MPE (Forum National de la Facture Électronique et des Marchés Publics Électroniques) en France, conjointement avec le FeRD en Allemagne, qui publie le même format sous le nom ZUGFeRD.</p>"
---

Une facture Factur-X, c’est un PDF qui contient une deuxième version de lui-même, écrite pour les machines.

Ouvrez-en une avec n’importe quel lecteur PDF : vous voyez une facture tout à fait ordinaire. Mais à l’intérieur, attaché comme une pièce jointe, il y a un fichier `factur-x.xml` qui reprend toutes les informations de la facture (qui vend, qui achète, quoi, combien, quelle TVA, quand payer) dans une structure normalisée. C’est ce fichier que lit le logiciel comptable du destinataire.

Ce double contenu est toute l’idée du format : le client humain lit le PDF, le logiciel lit le XML, et personne ne ressaisit rien.

## Pourquoi pas juste un PDF ?

Un PDF « normal », même produit par un logiciel de facturation, n’est qu’une image de texte. Pour en extraire le montant TTC, il faut soit le lire à l’œil, soit faire de la reconnaissance de caractères, qui se trompe de temps en temps (un 8 lu comme un 3 sur un total, et c’est la compta qui ne tombe plus juste).

La réforme de la facturation électronique en France part de ce constat. Elle ne demande pas seulement que la facture soit numérique : elle exige qu’elle soit **structurée**, c’est-à-dire que chaque donnée soit identifiée sans ambiguïté. Un PDF envoyé par e-mail ne remplit pas cette condition.

Il y avait deux façons d’y répondre :

- **le XML pur** (formats UBL ou CII) : parfait pour les machines, illisible pour un humain sans logiciel ;
- **le format hybride**, PDF + XML : c’est Factur-X.

Pour une PME ou un indépendant, l’hybride a un gros avantage pendant la transition : un client qui n’est pas encore équipé peut toujours ouvrir la facture et la lire.

## Ce qu’il y a dans le fichier, couche par couche

### 1. Un PDF/A-3

PDF/A est une famille de normes ISO pour l’archivage à long terme. Un PDF/A doit être autonome : polices incorporées, pas de dépendance externe, pas de chiffrement, des métadonnées décrites dans un format standard (XMP).

La version 3 (PDF/A-3) a une particularité qui intéresse Factur-X : elle autorise à joindre **n’importe quel fichier** au document, à condition de déclarer sa relation avec le contenu. Les versions 1 et 2 ne le permettaient pas, ou seulement pour d’autres PDF/A.

### 2. Le fichier XML joint

Le XML est attaché sous le nom `factur-x.xml`. Dans la structure interne du PDF, il est déclaré deux fois :

- dans la liste des fichiers incorporés (`/EmbeddedFiles`) ;
- dans la liste des « fichiers associés » du document (`/AF`), avec une relation `Alternative`, qui veut dire en clair : « ce fichier est une autre représentation du même contenu ».

C’est pour ça que la plupart des lecteurs PDF ne montrent rien de spécial : le XML est rangé dans le panneau des pièces jointes, que peu de gens ouvrent.

### 3. Les métadonnées XMP

Le PDF déclare dans ses métadonnées qu’il est un PDF/A-3, et ajoute une petite extension propre à Factur-X qui indique le nom du XML et le **profil** utilisé. Un logiciel qui reçoit le fichier peut donc savoir ce qu’il contient sans même ouvrir le XML.

```xml
<fx:DocumentType>INVOICE</fx:DocumentType>
<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
<fx:Version>1.0</fx:Version>
<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>
```

## Le XML : la syntaxe CII

Le XML n’est pas inventé pour l’occasion. Il suit la syntaxe **CII** (*Cross Industry Invoice*) des Nations unies (UN/CEFACT), dans la version D16B. Les noms de balises sont longs et assez peu poétiques, mais logiques une fois qu’on a compris le découpage :

```xml
<rsm:CrossIndustryInvoice>
  <rsm:ExchangedDocumentContext>   <!-- quel profil -->
  <rsm:ExchangedDocument>          <!-- numéro, date, type, notes -->
  <rsm:SupplyChainTradeTransaction>
    <ram:IncludedSupplyChainTradeLineItem>  <!-- une par ligne -->
    <ram:ApplicableHeaderTradeAgreement>    <!-- vendeur, acheteur -->
    <ram:ApplicableHeaderTradeDelivery>     <!-- livraison -->
    <ram:ApplicableHeaderTradeSettlement>   <!-- TVA, paiement, totaux -->
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
```

Chaque donnée correspond à un « terme métier » de la norme européenne **EN 16931**, numéroté BT-1, BT-2… Par exemple, le numéro de facture est le BT-1, la date d’émission le BT-2, le SIREN du vendeur le BT-30. Ces numéros reviennent partout, y compris dans les messages d’erreur des plateformes : les connaître aide beaucoup.

## Factur-X et ZUGFeRD, même combat

ZUGFeRD est le format allemand, Factur-X le format français. Depuis ZUGFeRD 2.1 (2020), les deux sont alignés et produisent des fichiers identiques, à un détail près : le nom de la pièce jointe, `zugferd-invoice.xml` dans certaines versions allemandes. Les versions récentes portent des numéros différents (Factur-X 1.08 correspond à ZUGFeRD 2.4), mais c’est le même travail, mené conjointement par le FNFE-MPE et le FeRD.

En pratique, un lecteur Factur-X sait lire ZUGFeRD 2.x et inversement. L’ancien ZUGFeRD 1.0, lui, utilisait une autre structure XML (`CrossIndustryDocument`) et n’est plus accepté.

## Les profils, en une phrase chacun

Factur-X se décline en cinq niveaux de détail, du plus léger au plus complet :

| Profil | Ce qu’il contient | Accepté comme facture par la réforme ? |
|---|---|---|
| MINIMUM | l’en-tête et les totaux, pas de lignes | non |
| BASIC WL | en-tête, totaux, ventilation de TVA, pas de lignes | non |
| BASIC | tout ce qui précède + les lignes, en version simple | oui |
| EN 16931 | l’ensemble de la norme européenne | oui |
| EXTENDED | EN 16931 + des données propres à certains métiers | oui |

Le détail, avec des exemples de cas où chaque profil est utile, est dans [le guide sur les profils Factur-X](/guides/profils-factur-x/).

## Ce qu’il faut retenir

- Une facture Factur-X, c’est un **PDF/A-3** + un **XML CII** en pièce jointe + des **métadonnées** qui annoncent le profil.
- C’est le XML qui fait foi pour le traitement automatique. Si le PDF et le XML divergent, c’est un problème.
- « Imprimer en PDF » une facture Factur-X fait disparaître le XML. Le fichier obtenu n’est plus une facture électronique.
- Pour voir ce que contient une facture que vous avez reçue, [déposez-la dans le lecteur Factur-X](/lire-facture-factur-x/) : il extrait le XML et l’affiche en clair, sans rien envoyer sur internet.
