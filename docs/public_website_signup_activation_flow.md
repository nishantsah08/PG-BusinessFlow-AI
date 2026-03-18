# Public Website Entry, Signup, And CEO Activation Flow

## Objective

Define how potential customers enter the product, create a workspace, and complete CEO activation before business usage starts.

This flow exists to support public entry without opening internal business operations to anonymous use.

---

## 1. Public Website Entry

The website root is public.

Its purpose is:

- give a clean public entry into the product
- allow sign in and sign up from one place
- provide a docs link for detailed reading outside the app surface
- lead the user into account creation or sign in

The root page is intentionally compact.

It should not behave like a long marketing site inside the app.

Detailed product reading should live on the docs site linked from the top of the page.

---

## 2. Public Account Creation

Account creation is public through Google login.

Meaning:

- any valid Google user may attempt sign up
- a new workspace may be created on sign up
- existing users may sign in to their workspace

This public entry does **not** mean the internal product is public.

Protected workspace routes still require:

- authenticated user
- resolved tenant context
- role-based access enforcement

---

## 3. CEO Activation Rule

A newly created workspace is not fully active until the CEO phone is verified.

Activation flow:

```text
public workspace entry page
-> Google sign up
-> workspace created
-> CEO phone entered
-> OTP sent on WhatsApp
-> OTP verified
-> workspace activated
```

Before verification:

- the workspace remains in `PENDING_CEO_PHONE_VERIFICATION`
- protected business usage stays blocked

After verification:

- the phone becomes the trusted owner phone
- the CEO identity is bound across portal and WhatsApp
- the CEO CRM profile is created or updated

---

## 4. WhatsApp OTP Delivery

The CEO OTP uses an approved WhatsApp template.

Current approved template:

- `otp_en`

Template variable:

- `{{code}}`

Environment behavior:

- local development may keep simulator behavior
- shared pre-production uses the approved WhatsApp template path

---

## 5. Route Model

Public routes:

- `/`
- `/login`

Protected routes:

- `/app/*`
- `/activate-ceo` for authenticated but not yet activated CEO flow

Legacy internal paths may redirect into `/app/*` for compatibility.

---

## 6. Deployment Note

The first rollout for this flow is on the current development hosting and backend targets.

For this initiative, those development targets act as the shared pre-production surface.

This must be deployed carefully:

- only deploy to the defined Firebase hosting target
- do not use broad Firebase deploy commands that may affect unrelated hosted sites
- keep backend auth and debug behavior locked for shared testing

---

## 7. Business Intent

The main business goal is simple:

make the product easy to enter and try, while keeping business control and owner verification intact.
