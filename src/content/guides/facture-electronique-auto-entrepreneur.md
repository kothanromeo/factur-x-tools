---
title: "Facture électronique et auto-entrepreneur : ce qui change entre 2026 et 2027"
seoTitle: "Facture électronique auto-entrepreneur : obligations 2026-2027 et Factur-X"
description: "Micro-entrepreneur : réception depuis septembre 2026, émission en septembre 2027. Ce qu’il faut faire maintenant, et comment coder la franchise en base de TVA."
keywords: ["facture électronique auto-entrepreneur", "facture électronique micro-entreprise", "facturation électronique 2027", "auto-entrepreneur 2026 facture", "franchise en base tva facture électronique", "art 293 b cgi facture électronique", "plateforme agréée auto-entrepreneur", "e-reporting auto-entrepreneur", "factur-x auto-entrepreneur", "facture électronique obligatoire"]
published: 2026-11-09
faq:
  - q: "Je ne facture que des particuliers, suis-je concerné ?"
    a: "<p>Pas par l’obligation d’émettre des factures électroniques : elle ne vise que les ventes entre entreprises assujetties établies en France. En revanche, vous devez pouvoir recevoir les factures de vos fournisseurs, et vos ventes aux particuliers relèvent de l’e-reporting, une transmission de données agrégées à l’administration via votre plateforme.</p>"
  - q: "Je suis en franchise de TVA, suis-je quand même concerné ?"
    a: "<p>Oui. Le calendrier dépend de la taille de l’entreprise, pas de son régime de TVA. Une micro-entreprise en franchise en base doit recevoir des factures électroniques depuis le 1er septembre 2026 et les émettre à partir du 1er septembre 2027 pour ses clients professionnels.</p>"
  - q: "Puis-je continuer à envoyer mes factures PDF par e-mail ?"
    a: "<p>Jusqu’au 31 août 2027, oui, pour vos factures émises. À partir du 1er septembre 2027, une facture à un client professionnel français devra être une facture électronique structurée (Factur-X, UBL ou CII) transmise par une plateforme agréée.</p>"
  - q: "Existe-t-il une plateforme gratuite ?"
    a: "<p>Le portail public ne joue plus le rôle de plateforme de facturation gratuite depuis le recentrage décidé en 2024 : il gère l’annuaire et la collecte des données. En revanche, plusieurs plateformes agréées proposent des offres gratuites ou très peu chères pour les petits volumes. Comparez les conditions (nombre de factures, durée de conservation, export de vos données).</p>"
---

Si vous êtes micro-entrepreneur, la réforme de la facture électronique vous concerne en deux temps. Le premier est déjà passé, le second arrive. La bonne nouvelle : rien de tout ça n’est compliqué si on s’y prend quelques mois à l’avance.

## Le calendrier, sans détour

| Date | Ce qui devient obligatoire | Pour qui |
|---|---|---|
| 1er septembre 2026 | **Recevoir** des factures électroniques | Toutes les entreprises, micro-entreprises comprises |
| 1er septembre 2026 | **Émettre** des factures électroniques + e-reporting | Grandes entreprises et ETI |
| 1er septembre 2027 | **Émettre** des factures électroniques + e-reporting | PME, TPE et micro-entreprises |

Autrement dit : depuis la rentrée 2026, vos fournisseurs professionnels (votre banque, votre hébergeur, votre comptable s’il est en société…) peuvent vous envoyer des factures électroniques, et vous devez être en mesure de les recevoir. Pour envoyer les vôtres, vous avez jusqu’à septembre 2027.

Ce calendrier est celui de la loi de finances en vigueur au moment où j’écris. Il a déjà été repoussé une fois par le passé (le démarrage était initialement prévu en 2024), donc gardez un œil sur [la page officielle du ministère](https://www.economie.gouv.fr/tout-savoir-sur-la-facturation-electronique-pour-les-entreprises).

## Ce que « recevoir » veut dire concrètement

Recevoir une facture électronique ne se fait pas par e-mail. Il faut **choisir une plateforme agréée** (on parlait avant de « PDP », le nom officiel est désormais « plateforme agréée » ou PA). C’est elle qui reçoit les factures en votre nom, les met à votre disposition et transmet les données utiles à l’administration.

Votre plateforme est ensuite inscrite dans l’annuaire central, qui permet à n’importe quel fournisseur de savoir où vous envoyer vos factures à partir de votre SIREN.

Pour un micro-entrepreneur qui reçoit trois factures par mois, l’enjeu est surtout de ne pas se retrouver sans plateforme le jour où un fournisseur passe en facturation électronique. Beaucoup de banques en ligne et de logiciels de facturation pour indépendants proposent désormais ce service, parfois inclus dans l’abonnement.

## Ce que « émettre » voudra dire en 2027

À partir du 1er septembre 2027, une facture adressée à un client professionnel établi en France devra :

1. être produite dans un format structuré : **Factur-X**, UBL ou CII ;
2. contenir les mentions obligatoires, y compris [les quatre nouvelles mentions](/guides/nouvelles-mentions-obligatoires-facture-2026/) ;
3. être transmise via votre plateforme agréée.

Pour les clients particuliers et les clients à l’étranger, pas de facture électronique obligatoire, mais des données de transaction à déclarer : c’est l’**e-reporting**. Là encore, c’est votre plateforme qui s’en charge, à partir des informations que vous lui donnez.

> Le point de vigilance pour un micro-entrepreneur, c’est le format. Si vous faites vos factures sur Word, Excel ou Canva, elles ne seront plus valables pour vos clients professionnels en 2027. Il faudra passer par un logiciel ou une plateforme capable de produire un format structuré.

## Factur-X, le format le plus naturel pour un indépendant

Des trois formats acceptés, Factur-X est celui qui change le moins vos habitudes : la facture reste un PDF que votre client peut ouvrir et lire. La différence, c’est le fichier XML caché à l’intérieur, qui contient les mêmes informations sous une forme lisible par les logiciels.

Si vous voulez voir à quoi ça ressemble, le [générateur Factur-X](/creer-facture-factur-x/) du site produit une facture complète à partir d’un formulaire, et vous pouvez ensuite [l’ouvrir dans le lecteur](/lire-facture-factur-x/) pour voir le XML.

## La franchise en base de TVA dans une facture électronique

C’est le point qui pose le plus de questions aux micro-entrepreneurs, et c’est aussi la source d’erreurs la plus fréquente dans les fichiers.

Sur une facture papier, vous écrivez simplement « TVA non applicable, art. 293 B du CGI ». Dans une facture électronique conforme à la norme EN 16931, il faut aller plus loin :

- chaque ligne est classée dans la catégorie de TVA **E** (exonéré), et non dans la catégorie S avec un taux de 0 % ;
- le taux de la ligne est 0 ;
- la ventilation de TVA contient un **motif d’exonération** : le texte « TVA non applicable, art. 293 B du CGI » ;
- la norme demande un identifiant fiscal pour le vendeur. Si vous n’avez pas de numéro de TVA intracommunautaire, il faut renseigner un identifiant fiscal local.

Voici à quoi ressemble la ventilation de TVA correspondante dans le XML :

```xml
<ram:ApplicableTradeTax>
  <ram:CalculatedAmount>0.00</ram:CalculatedAmount>
  <ram:TypeCode>VAT</ram:TypeCode>
  <ram:ExemptionReason>TVA non applicable, art. 293 B du CGI</ram:ExemptionReason>
  <ram:BasisAmount>1200.00</ram:BasisAmount>
  <ram:CategoryCode>E</ram:CategoryCode>
  <ram:RateApplicablePercent>0</ram:RateApplicablePercent>
</ram:ApplicableTradeTax>
```

Le générateur du site fait tout ça automatiquement quand vous cochez « Franchise en base ». Le [validateur](/valider-factur-x/) signale l’erreur si le motif d’exonération manque.

## Les sanctions, pour mémoire

Le texte prévoit une amende de 15 € par facture non émise au format électronique, plafonnée à 15 000 € par an, et 250 € par manquement à l’e-reporting, avec le même plafond. Ce n’est pas ce qui ruinera un indépendant, mais un client professionnel pourra aussi refuser une facture qui n’est pas au bon format, et c’est là que ça devient gênant : une facture refusée, c’est un paiement qui attend.

## Ce que je ferais à votre place

1. **Maintenant** : choisir une plateforme agréée pour la réception, si ce n’est pas fait. Vérifier qu’elle apparaît dans l’annuaire avec votre SIREN.
2. **Début 2027** : vérifier que votre outil de facturation sait produire du Factur-X (ou de l’UBL), avec les nouvelles mentions. Faire un essai, et passer le fichier dans un validateur.
3. **Avant septembre 2027** : récupérer le SIREN de vos clients professionnels. Il devient obligatoire sur la facture, et c’est la donnée qui manque le plus souvent dans les fichiers clients.

Rien de tout ça ne demande de compétences techniques. La seule vraie difficulté, c’est de ne pas attendre août 2027 pour s’y mettre.
