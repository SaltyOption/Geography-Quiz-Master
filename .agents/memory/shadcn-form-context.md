---
name: shadcn Form context requirement
description: Why FormLabel/FormControl/FormMessage crash at render when used outside FormField.
---

# shadcn Form components require FormField context

`FormLabel`, `FormControl`, `FormMessage`, `FormItem`-bound helpers all call
`useFormField()`, which does `const { getFieldState } = useFormContext()` BEFORE
checking its own contexts. Using any of them outside the right context throws at
render time:
- Outside `<Form>` (no FormProvider): `Cannot destructure property 'getFieldState'
  from null` — the symptom often surfaces as a React "Maximum update depth exceeded"
  / runtime-error overlay because the error plugin re-renders the broken tree.
- Inside `<Form>` but outside a `<FormField>`: `useFormField should be used within
  <FormField>`.

**Rule:** only use `FormLabel`/`FormControl`/`FormMessage` inside a `FormField`'s
`render`. For standalone labels (section headers, controls not bound to a form
field — e.g. a "quick fill" helper card), use the plain `<Label>` from
`@/components/ui/label`, never `<FormLabel>`.

**Why:** hit twice on geo-quiz admin question forms. The add-question page had
`FormLabel` in a quick-fill card outside `<Form>` and a section-header `FormLabel`
inside `<Form>` but outside any `FormField` — both crashed the page on render.
