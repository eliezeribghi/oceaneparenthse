<!-- App.svelte -->
<script>
    // Aucun script n'est nécessaire pour cette page statique
</script>

<div class="container">
    <div class="custom-header">
        <h1>Itinéraire vers notre gîte</h1>
    </div>

    <div class="custom-main">
        <div class="instructions">
            <h2 >Comment venir depuis les principales villes :</h2>
            <ul>
                <li>
                    <strong>Depuis Paris :</strong> Prenez l'autoroute A11 en direction
                    de Nantes...
                </li>
                <li>
                    <strong>Depuis Nantes :</strong> Prenez l'A83 en direction de
                    La Roche-sur-Yon...
                </li>
                <li>
                    <strong>Depuis Bordeaux :</strong> Prenez l'A10 en direction
                    de Poitiers...
                </li>
            </ul>
        </div>

        <!-- Votre composant Svelte -->
        <iframe
            src="https://www.google.com/maps/d/embed?mid=1f3EkxUy4VLsVmHgcalpX69A2EFahOGA&ehbc=2E312F&noprof=1"
            width="100%"
            height="380"
            title="Google map"
        ></iframe>
    </div>
    <div class="text_footer">
        <p>
            Nous sommes impatients de vous accueillir dans notre gîte à
            Saint-Vincent-sur-Jard ! Si vous avez besoin de plus d'informations
            ou d'assistance pour trouver notre emplacement, n'hésitez pas à nous
            contacter.
        </p>
    </div>
</div>

<style>
    /* Styles généraux */
    .container {
        margin-top: 10em;
        line-height: 1.6;
        display: flex;
        flex-direction: column;
        align-items: center;
        width: auto;
        height: 100vh;
    }

    .custom-header {
     
        color: #1e55b3;
font-size: 1.4em;
        background-color: #fff;

        text-align: center;
    }

    .custom-main {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        flex-grow: 1;
    }

    .instructions {
        color: #1e55b3;
        text-align: center;
        margin: 1rem;
    }
   
    .text_footer p{

padding-bottom: 2em;
    }
    .instructions h2 {
padding: 1em;

    }

    /* Styles responsives */
    @media screen and (min-width: 48em) {
        .custom-main {
            flex-direction: row;
            justify-content: space-between;
        }

        .instructions {
            flex-basis: 100vh;
            padding-right: 4rem;
            margin-bottom: 5em;
        }
    }
</style>
