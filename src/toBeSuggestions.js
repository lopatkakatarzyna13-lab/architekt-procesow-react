const stepByCategory = new Map([
  ['Wąskie gardło', {
    name: 'Ustalenie terminu i reakcji na opóźnienie',
    description: 'Uzgodnij termin wykonania czynności i sposób reakcji, gdy sprawa czeka dłużej.',
    result: 'Ustalony termin i sposób zgłoszenia opóźnienia.',
  }],
  ['Ryzyko lub możliwość błędu', {
    name: 'Kontrola przed przejściem dalej',
    description: 'Ustal warunek, który pozwala wykryć błąd. Sprawdź go przed przejściem dalej i określ, gdzie wraca sprawa do poprawy.',
    result: 'Potwierdzenie poprawności lub wskazanie, co wymaga poprawy.',
  }],
  ['Zbędna lub powtarzalna czynność', {
    name: 'Uproszczenie powtarzalnej czynności',
    description: 'Sprawdź, czy można wykorzystać istniejący wynik lub zebrać dane raz. Potwierdź, że uproszczenie zachowa potrzebne kontrole.',
    result: 'Ustalony sposób wykonania czynności bez zbędnego powtarzania pracy.',
  }],
  ['Niejasna odpowiedzialność', {
    name: 'Przypisanie odpowiedzialności za czynność',
    description: 'Ustal, kto wykonuje czynność, kto rozstrzyga wyjątki i kto przejmuje sprawę przy nieobecności.',
    result: 'Uzgodnione role i zasady zastępstwa.',
  }],
  ['Problem z komunikacją lub przekazaniem', {
    name: 'Przekazanie danych z potwierdzeniem odbioru',
    description: 'Ustal, co przekazać, komu i jakim kanałem. Uzgodnij sposób potwierdzenia odbioru i reakcję na jego brak.',
    result: 'Potwierdzenie odbioru albo zgłoszenie braku przekazania.',
  }],
  ['Miejsce do automatyzacji', {
    name: 'Sprawdzenie warunków automatyzacji',
    description: 'Określ dane wejściowe, regułę działania, obsługę wyjątków i moment ewentualnej kontroli przez człowieka.',
    result: 'Warunki do oceny wykonalności automatyzacji.',
  }],
])

export const findingCategories = [...stepByCategory.keys(), 'Inne']

export function getToBeStepSuggestion(finding) {
  const name = typeof finding?.name === 'string' ? finding.name.trim() : ''
  if (!name || (typeof finding.improvement === 'string' && finding.improvement.trim())) return null
  const step = stepByCategory.get(finding.category)
  if (!step) return null
  return {
    ...step,
    description: `Ustalenie z analizy „${name}”. ${step.description}`,
  }
}

const formReturnException = 'Przy brakach wskaż pola do poprawy i wróć do formularza.'

export function isFormValidationStep(step) {
  return step.bpmnTaskType === 'service' &&
    (step.formSuggestion === 'validation' || step.bpmnException === formReturnException)
}

export function getFormImprovementSuggestions(finding, sourceStep, assumptions) {
  if (!finding) return []
  const context = [finding.name, finding.situation, finding.cause, finding.improvement].join(' ')
  const plannedChange = [context, assumptions?.changeGoal, assumptions?.expectedResult].join(' ')
  if (!/formularz/iu.test(plannedChange) || !/walidac|obowiązkow|wymagan|kompletn|brak|uzupełn/iu.test(context)) return []

  return [
    {
      name: 'Walidacja pól obowiązkowych',
      formSuggestion: 'validation',
      description: 'Formularz sprawdza kompletność zgłoszenia przed wysłaniem.',
      result: 'Kompletne zgłoszenie gotowe do przekazania.',
      bpmnTaskType: 'service',
      bpmnRule: 'Przekaż zgłoszenie dalej po uzupełnieniu wszystkich wymaganych pól.',
      bpmnException: formReturnException,
      ...(sourceStep?.bpmnRequiredData && { bpmnRequiredData: sourceStep.bpmnRequiredData }),
    },
    {
      name: 'Kontrola merytoryczna zgłoszenia przez człowieka',
      description: 'Osoba odpowiedzialna ocenia zgłoszenie po walidacji formularza.',
      result: 'Zatwierdzone zgłoszenie lub wskazanie danych do poprawy.',
      bpmnTaskType: 'user',
      bpmnHumanCheck: 'Osoba odpowiedzialna zatwierdza merytorycznie zgłoszenie przed przekazaniem do kolejnego kroku.',
    },
  ]
}
