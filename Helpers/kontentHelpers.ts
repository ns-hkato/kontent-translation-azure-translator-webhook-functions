import {
  ContentItemModels,
  ContentTypeModels,
  ElementModels,
  LanguageVariantModels,
  ManagementClient,
} from '@kentico/kontent-management'
import * as Models from '../Models'
import { Constants } from './constants'

const client: ManagementClient = initializeClient()

function initializeClient(): ManagementClient {
  if (!Constants.kontentManagementApiKey) {
    throw Error('CM API Key is not defined')
  }

  if (!Constants.kontentProjectId) {
    throw Error('Project ID is not defined')
  }

  return new ManagementClient({
    apiKey: Constants.kontentManagementApiKey,
    projectId: Constants.kontentProjectId,
  })
}

export async function changeWorkflowStep(
  contentItemId: string,
  languageId: string,
  workflowStepId?: string
): Promise<void> {
  if (!workflowStepId) {
    throw Error('Workflow step ID is undefined')
  }

  let languageVariant = await getLanguageVariant(contentItemId, languageId)

  if (languageVariant) {
    const isPublished = languageVariant.workflowStep.id === Constants.kontentWorkflowStepIdPublished

    if (isPublished) {
      await client.createNewVersionOfLanguageVariant().byItemId(contentItemId).byLanguageId(languageId).toPromise()
    }
  } else {
    const response = await client
      .upsertLanguageVariant()
      .byItemId(contentItemId)
      .byLanguageId(languageId)
      .withElements([])
      .toPromise()
    languageVariant = response.data
  }

  await client
    .changeWorkflowStepOfLanguageVariant()
    .byItemId(contentItemId)
    .byLanguageId(languageId)
    .byWorkflowStepId(workflowStepId)
    .toPromise()
}

export async function getContentItemById(contentItemId: string): Promise<ContentItemModels.ContentItem> {
  const clientReponse = await client.viewContentItem().byItemId(contentItemId).toPromise()

  return clientReponse.data
}

export async function getContentType(contentTypeId: string): Promise<ContentTypeModels.ContentType> {
  const clientResponse = await client.viewContentType().byTypeId(contentTypeId).toPromise()

  return clientResponse.data
}

export async function getDefaultLanguageVariant(
  contentItemId: string
): Promise<LanguageVariantModels.ContentItemLanguageVariant> {
  const defaultLanguage = await getLanguageVariant(contentItemId, Constants.kontentDefaultLanguageId)
  if (!defaultLanguage) {
    throw Error('Could not get default language')
  }

  return defaultLanguage
}

export async function getLanguageVariant(
  contentItemId: string,
  languageId: string
): Promise<LanguageVariantModels.ContentItemLanguageVariant | null> {
  try {
    const clientResponse = await client
      .viewLanguageVariant()
      .byItemId(contentItemId)
      .byLanguageId(languageId)
      .toPromise()

    return clientResponse.data
  } catch (e) {
    if (e.originalError.response.status === 404) {
      return null
    } else {
      throw e
    }
  }
}

export async function getTranslationDetails(
  languageVariant: LanguageVariantModels.ContentItemLanguageVariant
): Promise<Models.TranslationDetails> {
  const translationElement = await getTranslationElement(languageVariant)
  return new Models.TranslationDetails(translationElement.value as string)
}

export async function upsertLanguageVariant(
  itemId: string,
  languageId: string,
  elements: LanguageVariantModels.ILanguageVariantElement[]
): Promise<void> {
  await client.upsertLanguageVariant().byItemId(itemId).byLanguageId(languageId).withElements(elements).toPromise()
}

async function getTranslationElement(
  languageVariant: LanguageVariantModels.ContentItemLanguageVariant
): Promise<ElementModels.ContentItemElement> {
  const translationElementModel = await getTranslationElementModelFromSnippet()
  const translationElement = languageVariant.elements.find((e) => e.element.id === translationElementModel.id)
  if (translationElement) {
    return translationElement
  } else {
    throw Error('Translation element not found')
  }
}

async function getTranslationElementModelFromSnippet(): Promise<ElementModels.ElementModel> {
  if (!Constants.kontentTranslationSnippetCodename) {
    throw Error('Translation snippet codename is undefined')
  }

  const snippetTypeModel = await getSnippetTypeModelByCodename(Constants.kontentTranslationSnippetCodename)
  const translationElementModel = snippetTypeModel.elements.find((e) => {
    return e.codename === Constants.kontentTranslationElementCodename
  })

  if (translationElementModel) {
    return translationElementModel
  } else {
    throw Error('Translation element model not found')
  }
}

async function getSnippetTypeModelByCodename(codename: string): Promise<ContentTypeModels.ContentType> {
  const result = await client.viewContentTypeSnippet().byTypeCodename(codename).toPromise()

  return result.data
}

export async function updateTranslationDetails(
  t9nDetails: Models.TranslationDetails,
  languageVariant: LanguageVariantModels.ContentItemLanguageVariant
): Promise<void> {
  const t9nElement: LanguageVariantModels.ILanguageVariantElement = {
    element: {
      codename: `${Constants.kontentTranslationElementCodename}`,
    },
    value: JSON.stringify(t9nDetails),
  }

  if (languageVariant.item.id && languageVariant.language.id) {
    await upsertLanguageVariant(languageVariant.item.id, languageVariant.language.id, [t9nElement])
  } else {
    if (!languageVariant.item.id) {
      throw Error('Language Variant Item ID is undefined')
    }
    if (!languageVariant.language.id) {
      throw Error('Language Variant Language ID is undefined')
    }
  }
}

export function updateTimestamp(
  t9nDetails: Models.TranslationDetails,
  currentLanguageId: string,
  timestamp: Models.Timestamps
): void {
  t9nDetails.selectedLanguages.forEach((l) => {
    const languageIsCurrentLanguage = l.id === currentLanguageId
    if (languageIsCurrentLanguage) {
      switch (timestamp) {
        case Models.Timestamps.Started:
          l.started = new Date()
          break
        case Models.Timestamps.Completed:
          l.completed = new Date()
          break
      }
    }
    return l
  })
}

export function getNextLanguage(t9nDetails: Models.TranslationDetails): Models.LanguageDetails | undefined {
  return t9nDetails.selectedLanguages.find((l) => l.completed === null)
}
