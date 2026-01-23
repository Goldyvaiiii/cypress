import $dom from '../../dom'

export interface Predicate<T> {
  test: (subject: T, assertionNegated: boolean) => boolean
  errorPath: string
}

export const IsDom: Predicate<JQuery> = {
  test: (subject) => $dom.isDom(subject),
  errorPath: 'chai.invalid_jquery_obj',
}

export const PopulatedIfJquery: Predicate<JQuery> = {
  test: (subject) => $dom.isJquery(subject) ? subject.length > 0 : true,
  errorPath: 'chai.invalid_jquery_obj',
}
