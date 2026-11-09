---
title: "Profils Factur-X : MINIMUM, BASIC WL, BASIC, EN 16931, EXTENDED, lequel choisir ?"
seoTitle: "Profils Factur-X (MINIMUM, BASIC, EN 16931, EXTENDED) : lequel choisir ?"
description: "Les 5 profils Factur-X comparés : ce que chacun contient, lesquels la réforme accepte, et pourquoi EN 16931 est le bon choix par défaut."
published: 2026-11-09
faq:
  - q: "Comment savoir quel profil utilise une facture ?"
    a: "<p>Le profil est écrit dans le XML (balise GuidelineSpecifiedDocumentContextParameter, terme BT-24) et répété dans les métadonnées du PDF. Le plus simple : déposez la facture dans le lecteur Factur-X du site, le profil s’affiche en haut du résultat.</p>"
  - q: "COMFORT et EN 16931, c’est pareil ?"
    a: "<p>Oui. COMFORT est l’ancien nom utilisé par ZUGFeRD pour le profil qui correspond exactement à la norme EN 16931. Les fichiers récents utilisent le nom EN 16931.</p>"
  - q: "Peut-on changer de profil d’une facture à l’autre ?"
    a: "<p>Techniquement oui, chaque fichier déclare son propre profil. En pratique, votre logiciel de facturation en utilise un seul, et c’est très bien ainsi.</p>"
---

Quand on génère ou qu’on reçoit une facture Factur-X, on tombe vite sur ce mot : **profil**. Il désigne le niveau de détail du XML embarqué. Il y en a cinq, chacun contenant le précédent, et ils ne se valent pas du tout au regard de la réforme française.

Réponse courte pour les pressés : **prenez EN 16931**. La suite explique pourquoi, et dans quels cas un autre profil se justifie.

## Les cinq profils en un tableau

| | MINIMUM | BASIC WL | BASIC | EN 16931 | EXTENDED |
|---|:-:|:-:|:-:|:-:|:-:|
| Numéro, date, vendeur, acheteur | ✓ | ✓ | ✓ | ✓ | ✓ |
| Totaux HT, TVA, TTC | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ventilation de la TVA par taux | | ✓ | ✓ | ✓ | ✓ |
| Remises et frais au niveau du document | | ✓ | ✓ | ✓ | ✓ |
| Adresses complètes, échéance, IBAN | | ✓ | ✓ | ✓ | ✓ |
| **Lignes de facture** | | | ✓ | ✓ | ✓ |
| Prix brut, remises par ligne, attributs d’article | | | partiel | ✓ | ✓ |
| Toute la norme EN 16931 | | | | ✓ | ✓ |
| Sous-lignes, plusieurs livraisons, données métier | | | | | ✓ |

Le tableau simplifie un peu (chaque profil a sa liste exacte de champs dans la spécification), mais l’essentiel est là : **la frontière qui compte passe entre BASIC WL et BASIC**, parce que c’est là qu’apparaissent les lignes de facture.

## MINIMUM et BASIC WL : pas des factures au sens de la réforme

« WL » veut dire *without lines*, sans lignes. Ces deux profils ne décrivent pas ce qui est vendu. Ils ont été conçus pour une étape intermédiaire : permettre à un logiciel comptable de pré-remplir une écriture (fournisseur, montant, TVA, échéance) en attendant que tout le monde passe à des factures complètes.

Pour la réforme française, ça ne suffit pas. Une facture électronique doit contenir les mentions obligatoires d’une facture, dont la désignation des biens ou services. Un Factur-X MINIMUM ou BASIC WL est donc traité comme une facture papier accompagnée de données comptables. Il ne remplit pas l’obligation.

Si vous recevez encore des fichiers dans ces profils, c’est le signe que le logiciel de votre fournisseur n’est pas à jour.

## BASIC : le minimum acceptable

BASIC ajoute les lignes, avec l’essentiel : désignation, quantité, unité, prix net, taux de TVA, montant. C’est un sous-ensemble de la norme EN 16931, et il est « compliant » avec elle, ce qui veut dire que tout fichier BASIC valide est aussi un fichier EN 16931 valide.

Il convient à des factures simples, mais il manque quelques données qu’on utilise plus souvent qu’on ne croit : prix brut avant remise sur une ligne, références d’articles chez l’acheteur, période de facturation par ligne… Dès que votre facture en a besoin, BASIC devient étroit.

## EN 16931 : le choix par défaut

Ce profil correspond exactement à la norme européenne EN 16931, qui définit le modèle sémantique de la facture électronique dans toute l’Union. Concrètement :

- toutes les plateformes agréées savent le traiter ;
- il couvre tout ce qu’une PME, un artisan ou un indépendant met sur une facture ;
- il est validé par les règles Schematron officielles de la norme, ce qui facilite le diagnostic quand un fichier est refusé.

Dans le XML, il se reconnaît à cet identifiant :

```xml
<ram:GuidelineSpecifiedDocumentContextParameter>
  <ram:ID>urn:cen.eu:en16931:2017</ram:ID>
</ram:GuidelineSpecifiedDocumentContextParameter>
```

C’est le profil que produit le [générateur de factures Factur-X](/creer-facture-factur-x/) du site.

## EXTENDED : pour les cas qui débordent de la norme

EXTENDED est un sur-ensemble de EN 16931 (« conformant », et non plus « compliant »). Il ajoute des données que la norme européenne ne prévoit pas : lignes regroupées en sous-totaux, plusieurs adresses de livraison, informations logistiques détaillées, certains cas de facturation de travaux…

Il est utile pour le BTP, l’industrie ou la grande distribution, quand le logiciel le gère correctement. Pour une facture classique, il n’apporte rien, et il ajoute un risque : une plateforme qui ne traite que le périmètre EN 16931 peut ignorer les données en plus.

## Les identifiants de chaque profil

Si vous devez vérifier un fichier à la main, voici la valeur de BT-24 attendue pour chaque profil Factur-X :

| Profil | Identifiant (BT-24) |
|---|---|
| MINIMUM | `urn:factur-x.eu:1p0:minimum` |
| BASIC WL | `urn:factur-x.eu:1p0:basicwl` |
| BASIC | `urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic` |
| EN 16931 | `urn:cen.eu:en16931:2017` |
| EXTENDED | `urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended` |

Le profil déclaré dans les métadonnées du PDF (`fx:ConformanceLevel`) doit correspondre à celui du XML. Un écart entre les deux est une erreur classique, que le [validateur Factur-X](/valider-factur-x/) détecte.

## Et la version 1.08 ?

Le numéro de version de Factur-X (1.07, 1.08…) est indépendant du profil. Les versions successives corrigent des listes de codes, alignent le format sur les évolutions de la norme et, pour les dernières, intègrent les besoins de la réforme française, comme les nouvelles mentions obligatoires. Un fichier EN 16931 produit avec une version récente reste un fichier EN 16931.

## En résumé

- **MINIMUM, BASIC WL** : pas de lignes, pas de facture électronique au sens de la réforme.
- **BASIC** : acceptable pour des factures très simples.
- **EN 16931** : le bon choix par défaut, compris partout.
- **EXTENDED** : seulement si votre métier en a besoin et que votre chaîne de traitement le gère.
