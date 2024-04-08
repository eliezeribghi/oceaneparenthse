<script>
    let agreement = [
        { 
            title: "Article 1 - Objet",
            content: "Ce contrat de location est destiné à l’usage exclusif de la réservation de gîtes."
        },
        {
            title: "Article 2 - Durée du Séjour",
            content: "Le locataire signataire du présent contrat conclu pour une durée déterminée ne pourra en aucune circonstance se prévaloir d'un quelconque droit au maintien dans les lieux à l'issue du séjour."
        },
        {
            title: "Article 3 - Conclusion du Contrat",
            content: "La réservation devient effective dès lors que le locataire aura fait parvenir au propriétaire l’acompte indiqué au recto ainsi qu’un exemplaire du contrat signé avant la date indiquée au recto. Un deuxième exemplaire est à conserver par le locataire. La location conclue entre les parties au présent acte ne peut en aucun cas bénéficier même partiellement à des tiers, personnes physiques ou morales, sauf accord écrit du propriétaire. Toute infraction à ce dernier alinéa serait susceptible d'entraîner la résiliation immédiate de la location aux torts du locataire, le produit de la location restant définitivement acquis au propriétaire."
        },
        {
            title: "Article 4 - Absence de Rétractation",
            content: "Pour les réservations effectuées par courrier, par téléphone ou par internet, le locataire ne bénéficie pas du délai de rétractation, et ce conformément à l’article L121-20-4 du code de la consommation relatif notamment aux prestations de services d’hébergement fournies à une date ou selon une périodicité déterminée."
        },
        {
            title: "Article 5 - Annulation par le Locataire",
            content: "Toute annulation doit être notifiée au propriétaire par lettre recommandée avec accusé de réception. a) Annulation avant l'arrivée dans les lieux : L'acompte reste acquis au propriétaire. Celui-ci pourra demander le solde du montant du séjour, si l'annulation intervient moins de 30 jours avant la date prévue d'entrée dans les lieux. Si le locataire ne se manifeste pas dans les 24 heures qui suivent la date d'arrivée indiquée sur le contrat, le présent contrat devient nul et le propriétaire peut disposer de son gîte. L'acompte reste également acquis au propriétaire qui demandera le solde de la location. b) Si le séjour est écourté, le prix de la location reste acquis au propriétaire. Il ne sera procédé à aucun remboursement."
        },
        {
            title: "Article 6 - Annulation par le Propriétaire",
            content: "Le propriétaire reverse au locataire l’intégralité des sommes versées par avance."
        },
        {
            title: "Article 7 - Arrivée",
            content: "Le locataire doit se présenter le jour précisé dans le créneau horaire mentionné sur le présent contrat. En cas d'arrivée tardive ou différée, le locataire doit prévenir le propriétaire."
        },
        {
            title: "Article 8 - Règlement du Solde",
            content: "Le solde de la location est à régler à l'entrée dans les lieux."
        },
        {
            title: "Article 9 – Taxes de Séjour",
            content: "Les tarifs de location ne comprennent pas les taxes de séjour. Les taxes de séjour applicables en 2024, selon la réglementation locale, sont de 0,71 € par jour et par adulte de plus de 18 ans pour un gîte classé 2 étoiles, et de 0,77 € par jour et par adulte de plus de 18 ans pour un gîte classé 3 étoiles. Ces taxes seront collectées auprès des clients à leurs arrivées pour les séjours effectués entre le 01 avril et le 30 septembre."
        },
        {
            title: "Article 10 - Conditions de Paiement",
            content: "a. Pour réserver un séjour aux gîtes Parenthèse Océane situés au 32, rue de Saint-Hilaire à Saint-Vincent sur Jard, en Vendée, les clients doivent effectuer un paiement initial de 30% du montant total de la location au moment de la réservation. b. Le solde restant doit être réglé au plus tard 30 jours avant la date d'arrivée prévue. c. Tous les paiements doivent être effectués conformément aux méthodes de paiement acceptées par Parenthèse Océane, telles Chèque bancaire à l'ordre de M. Pascal FOUESNANT ou Virement bancaire."
        },
        {
            title: "Article 11 - Responsabilités",
            content: "a. Les clients sont responsables de respecter les règles et réglementations applicables aux gîtes Parenthèse Océane. b. Tout dommage matériel causé aux installations pendant le séjour sera facturé au client."
        },
        {
            title: "Article 12 - Modification des Conditions",
            content: "Parenthèse Océane se réserve le droit de modifier les présentes conditions générales de vente. Les clients seront informés de toute modification via les canaux de communication appropriés."
        },
        {
            title: "Article 13 - Litiges",
            content: "Toute réclamation relative à la location sera traitée par le Tribunal compétent. En confirmant une réservation aux gîtes Parenthèse Océane, les clients reconnaissent avoir lu, compris et accepté les présentes conditions générales de vente."
        }
    ];
</script>

<section class="agreement">

<main class="container_agr">
 <h1 class="page-title"> Parenthèse Océane - Conditions Générales de Vente</h1>   
    {#each agreement as item}
        <section class="agreement-section">
            <h2 class="section-title">{item.title}</h2>
            <p class="section-content">{item.content}</p>
        </section>
    {/each}
</main>
</section>

