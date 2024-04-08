<!-- ChartConfidentialite.svelte -->

<script>
    const privacyPolicyData = [
        { section: 'Introduction', description: 'La présente Charte de Confidentialité régit la manière dont Parenthèse Océane collecte, utilise, conserve et divulgue les informations recueillies auprès des utilisateurs (chacun, un "Utilisateur") de notre site web ([URL du site]). Cette charte de confidentialité s\'applique au site et à tous les produits et services proposés par Parenthèse Océane.' },
        { section: 'Collecte d\'Informations Personnelles', description: 'Nous collectons les informations que vous fournissez volontairement lorsque vous remplissez le formulaire de contact sur notre site. Ces informations peuvent inclure, mais ne sont pas limitées à :\n- Nom et prénom\n- Adresse e-mail\n- Numéro de téléphone\n- Sujet de votre demande\n- Message détaillant votre demande' },
        { section: 'Utilisation des Informations Collectées', description: 'Les informations que vous nous fournissez sont utilisées uniquement dans le but de répondre à votre demande de contact. Nous ne partageons pas ces informations avec des tiers, sauf dans les cas où cela est nécessaire pour répondre à votre demande spécifique.' },
        { section: 'Protection de Vos Informations Personnelles', description: 'Nous prenons des mesures de sécurité appropriées pour protéger vos informations personnelles contre tout accès non autorisé, altération, divulgation ou destruction.' },
        { section: 'Modification de la Charte de Confidentialité', description: 'Parenthèse Océane se réserve le droit de mettre à jour cette charte de confidentialité à tout moment. Nous vous encourageons à consulter fréquemment cette page pour rester informé des modifications. Vous reconnaissez et acceptez qu\'il est de votre responsabilité de revoir périodiquement cette charte de confidentialité et de vous familiariser avec les modifications.' },
        { section: 'Votre Acceptation de Cette Charte', description: 'En utilisant ce site, vous signifiez votre acceptation de cette charte de confidentialité. Si vous n\'acceptez pas cette charte, veuillez ne pas utiliser notre site.' },
        { section: 'Contactez-nous', description: 'Si vous avez des questions concernant cette charte de confidentialité, veuillez nous contacter à :\nParenthèse Océane\n32 Route de Saint-Hilaire\n85520 Saint-Vincent-sur-Jard\nTéléphone : +33 1 23 45 67 89\nE-mail : parentheseoceane@orange.fr' }
    ];
</script>



    <section class="privacyPolicy" aria-labelledby="privacyPolicyTitle">
        <h1 id="privacyPolicyTitle">Charte de Confidentialité</h1>
        {#each privacyPolicyData as { section, description }}
            <div class="confidentialityPolicy">
                <h2>{section}</h2>
                <p>{description}</p>
            </div>
        {/each}
    </section>

