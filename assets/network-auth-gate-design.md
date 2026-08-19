# Browser data gate

Before Firebase grants `auth-granted`, requests to the public market provider and Cloud Run product/model services are blocked in-browser. This is defense-in-depth: it prevents the hidden dashboard from fetching protected product data before login, but it does not replace backend authentication.

On `btc:auth-granted` the dashboard refreshes immediately. If the session is later revoked, the visual gate removes `auth-granted` and subsequent protected fetches fail closed.
