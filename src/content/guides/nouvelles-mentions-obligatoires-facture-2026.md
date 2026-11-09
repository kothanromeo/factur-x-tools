---
title: "Les 4 nouvelles mentions obligatoires sur les factures (2026) et où les mettre dans Factur-X"
seoTitle: "Nouvelles mentions obligatoires facture 2026 : SIREN client, livraison, catégorie, TVA débits"
description: "SIREN du client, adresse de livraison, catégorie d’opération, TVA sur les débits : les 4 mentions de la réforme et le champ exact du XML Factur-X."
published: 2026-11-09
faq:
  - q: "Ces mentions sont-elles obligatoires sur une facture à un particulier ?"
    a: "<p>Le SIREN de l’acheteur n’a pas de sens pour un particulier, qui n’en a pas. Les nouvelles mentions visent avant tout les factures entre entreprises. Pour une vente à un particulier, ce sont les mentions habituelles qui s’appliquent.</p>"
  - q: "Que mettre si mon client professionnel est étranger ?"
    a: "<p>Il n’a pas de SIREN : laissez ce champ vide et indiquez son numéro de TVA intracommunautaire s’il en a un. Les factures à des clients étrangers ne passent d’ailleurs pas par la facturation électronique obligatoire mais par l’e-reporting.</p>"
  - q: "Mon logiciel ne propose pas ces champs, que faire ?"
    a: "<p>Demandez à l’éditeur sa feuille de route : tous les logiciels sérieux les ont ajoutés pour 2026. En attendant, vous pouvez générer un Factur-X conforme avec le générateur du site et comparer avec ce que produit votre logiciel.</p>"
---

La réforme de la facture électronique n’a pas seulement changé le format des factures. Elle a aussi ajouté **quatre mentions** à la liste des informations obligatoires. Elles sont applicables depuis le 1er septembre 2026, en même temps que l’obligation de réception.

Les voici, avec à chaque fois ce que ça veut dire en pratique et où la donnée se place dans le XML d’une facture Factur-X.

## 1. Le SIREN du client

**Ce qui change** : jusqu’ici, seul le SIREN du vendeur figurait obligatoirement sur la facture. Celui de l’acheteur devient obligatoire quand c’est une entreprise française.

**Pourquoi** : c’est la clé qui permet d’acheminer la facture. L’annuaire central associe chaque SIREN à une plateforme de réception. Sans le SIREN du client, la plateforme du vendeur ne sait pas où envoyer la facture.

**Dans le XML** (terme BT-47) :

```xml
<ram:BuyerTradeParty>
  <ram:Name>Boulangerie Martin &amp; Fils</ram:Name>
  <ram:SpecifiedLegalOrganization>
    <ram:ID schemeID="0002">732829320</ram:ID>
  </ram:SpecifiedLegalOrganization>
  ...
</ram:BuyerTradeParty>
```

Le `schemeID="0002"` signifie « numéro SIREN » (c’est le code attribué à l’INSEE dans la liste internationale des identifiants d’organisations). Un SIREN fait 9 chiffres et se termine par une clé de contrôle (algorithme de Luhn) : le [validateur Factur-X](/valider-factur-x/) la vérifie, ce qui attrape les fautes de frappe.

**Le piège** : votre fichier clients. Beaucoup d’entreprises n’ont jamais demandé le SIREN de leurs clients. C’est le moment de compléter, l’annuaire des entreprises de l’État permet de le retrouver à partir du nom et de la ville.

## 2. L’adresse de livraison, si elle est différente

**Ce qui change** : quand les biens sont livrés ailleurs qu’à l’adresse de facturation du client, l’adresse de livraison doit apparaître sur la facture.

**Pourquoi** : elle sert à déterminer le lieu de l’opération, donc les règles de TVA applicables, et à mieux tracer les flux de marchandises.

**Dans le XML** (groupe BG-15, « Livrer à ») :

```xml
<ram:ApplicableHeaderTradeDelivery>
  <ram:ShipToTradeParty>
    <ram:Name>Entrepôt Nord</ram:Name>
    <ram:PostalTradeAddress>
      <ram:PostcodeCode>59000</ram:PostcodeCode>
      <ram:LineOne>ZI des Près, bâtiment C</ram:LineOne>
      <ram:CityName>Lille</ram:CityName>
      <ram:CountryID>FR</ram:CountryID>
    </ram:PostalTradeAddress>
  </ram:ShipToTradeParty>
</ram:ApplicableHeaderTradeDelivery>
```

Si l’adresse de livraison est la même que celle du client, ne la répétez pas : la mention n’est requise que lorsqu’elle diffère.

## 3. La catégorie de l’opération

**Ce qui change** : la facture doit indiquer si elle porte sur des **livraisons de biens**, des **prestations de services**, ou **les deux**.

**Pourquoi** : les règles d’exigibilité de la TVA ne sont pas les mêmes pour les biens (à la livraison) et pour les services (à l’encaissement, sauf option). L’administration veut pouvoir le savoir sans deviner à partir des désignations.

**Dans le XML** : dans les spécifications françaises, cette information est portée par le **cadre de facturation** (BT-23), un code dont la première lettre donne la catégorie : `B` pour les biens, `S` pour les services, `M` pour une facture mixte. Pour une facture ordinaire, on utilise `B1`, `S1` ou `M1` :

```xml
<rsm:ExchangedDocumentContext>
  <ram:BusinessProcessSpecifiedDocumentContextParameter>
    <ram:ID>S1</ram:ID>
  </ram:BusinessProcessSpecifiedDocumentContextParameter>
  <ram:GuidelineSpecifiedDocumentContextParameter>
    <ram:ID>urn:cen.eu:en16931:2017</ram:ID>
  </ram:GuidelineSpecifiedDocumentContextParameter>
</rsm:ExchangedDocumentContext>
```

Les autres valeurs (`S2`, `B4`, `S5`…) couvrent des cas particuliers : facture déjà payée, facture définitive après acompte, sous-traitance, cotraitance. Votre plateforme agréée peut vous indiquer celles qu’elle attend.

## 4. L’option pour le paiement de la TVA d’après les débits

**Ce qui change** : si vous êtes prestataire de services et que vous avez opté pour payer la TVA à la facturation (« sur les débits ») plutôt qu’à l’encaissement, la facture doit le dire.

**Pourquoi** : pour que votre client sache quand il peut déduire la TVA. Avec l’option, il peut la déduire dès la facture ; sans, il doit attendre de l’avoir payée.

**Dans le XML** : c’est le terme BT-8, le code de date d’exigibilité de la TVA. Dans la syntaxe CII utilisée par Factur-X, l’option sur les débits se traduit par le code `5` (« date de facture ») dans la ventilation de TVA :

```xml
<ram:ApplicableTradeTax>
  <ram:CalculatedAmount>526.00</ram:CalculatedAmount>
  <ram:TypeCode>VAT</ram:TypeCode>
  <ram:BasisAmount>2630.00</ram:BasisAmount>
  <ram:CategoryCode>S</ram:CategoryCode>
  <ram:DueDateTypeCode>5</ram:DueDateTypeCode>
  <ram:RateApplicablePercent>20</ram:RateApplicablePercent>
</ram:ApplicableTradeTax>
```

Si vous n’avez jamais fait de démarche pour opter, vous n’êtes pas concerné : ne mettez rien. Le code ne doit apparaître que si l’option a réellement été exercée.

## Et les mentions qui existaient déjà ?

Elles restent toutes obligatoires, et certaines ont désormais une place précise dans le XML. Les plateformes attendent en particulier trois notes codées pour les conditions de paiement, que l’on oublie souvent :

| Mention | Code de la note |
|---|---|
| Indemnité forfaitaire de 40 € pour frais de recouvrement | `PMT` |
| Taux des pénalités de retard | `PMD` |
| Conditions d’escompte (ou absence d’escompte) | `AAB` |

```xml
<ram:IncludedNote>
  <ram:Content>Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement : 40 €.</ram:Content>
  <ram:SubjectCode>PMT</ram:SubjectCode>
</ram:IncludedNote>
```

## Vérifier ses factures

Le plus rapide pour savoir si vos factures actuelles sont prêtes : en prendre une, produite par votre logiciel, et la déposer dans le [validateur Factur-X](/valider-factur-x/). La section « Réforme française » des contrôles liste précisément ces mentions, présentes ou absentes. Si votre logiciel ne produit pas encore de Factur-X, le [générateur](/creer-facture-factur-x/) vous montre à quoi doit ressembler un fichier complet.
