import { AzureFunction, Context, HttpRequest } from '@azure/functions'
import * as WebhookHelpers from '../Helpers/webhookHelpers'
import { constants } from '../Helpers/constants'
import * as KontentHelpers from '../Helpers/kontentHelpers'
import { LanguageVariantModels, ElementModels } from '@kentico/kontent-management'
import * as Models from '../Models'

const httpTrigger: AzureFunction = async function(context: Context, request: HttpRequest) {
  if (!WebhookHelpers.isRequestValid(request)) return WebhookHelpers.getResponse('Invalid webhook', 400)

  const workflowEventItem = WebhookHelpers.getWorkflowEventItem(request)
  const defaultLanguageVariant = await KontentHelpers.getDefaultLanguageVariant(workflowEventItem.item.id)

  if (WebhookHelpers.isLanguageDefault(workflowEventItem.language.id)) {
    await startNewTranslation(defaultLanguageVariant)
    return WebhookHelpers.getResponse('New translation job started')
  } else {
    await translateLanguageVariant(defaultLanguageVariant, workflowEventItem.language.id)
    return WebhookHelpers.getResponse(`Language translated: ${workflowEventItem.language.id}`)
  }
}

async function startNewTranslation(defaultLanguageVariant: LanguageVariantModels.ContentItemLanguageVariant) {
  const t9nDetails = await KontentHelpers.getTranslationDetails(defaultLanguageVariant)

  // Clear translation timestamps
  await clearTranslationTimestamps(defaultLanguageVariant, t9nDetails)

  const firstLanguage = t9nDetails.selectedLanguages.length > 0 ? t9nDetails.selectedLanguages[0] : null

  if (!firstLanguage) {
    return
  }

  await KontentHelpers.changeWorkflowStep(
    defaultLanguageVariant.item.id,
    firstLanguage.id,
    constants.kontentTranslationPendingWorkflowStepId
  )
}

async function clearTranslationTimestamps(
  defaultLanguageVariant: LanguageVariantModels.ContentItemLanguageVariant,
  t9nDetails: Models.TranslationDetails
) {
  t9nDetails.selectedLanguages = t9nDetails.selectedLanguages.map(language => {
    return {
      ...language,
      started: null,
      completed: null,
    }
  })

  await updateTranslationDetails(t9nDetails, defaultLanguageVariant)
}

async function updateTranslationDetails(
  t9nDetails: Models.TranslationDetails,
  languageVariant: LanguageVariantModels.ContentItemLanguageVariant
) {
  const t9nElement = {
    element: {
      codename: `${constants.translationSnippetCodename}__${constants.translationElementCodename}`,
    },
    value: JSON.stringify(t9nDetails),
  }
  await KontentHelpers.upsertLanguageVariant(languageVariant, [t9nElement])
}

async function translateLanguageVariant(
  defaultLanguageVariant: LanguageVariantModels.ContentItemLanguageVariant,
  currentLanguageId: string
): Promise<void> {
  let t9nDetails = await KontentHelpers.getTranslationDetails(defaultLanguageVariant)

  // Set language started timestamp in DLV
  updateTimestamp(t9nDetails, currentLanguageId, 'started')

  // Get elements to translate from DLV
  //const translatableElementIds = getTranslatableElementIds(defaultLanguageVariant)
  // Translate element values
  // Set LV element values
  // Upsert LV to save translation
  // Change LV WF to "review"

  // Set language completed timestamp in DLV
  updateTimestamp(t9nDetails, currentLanguageId, 'completed')

  // Upsert DLV to save LV timestamps
  updateTranslationDetails(t9nDetails, defaultLanguageVariant)
}

function updateTimestamp(t9nDetails: Models.TranslationDetails, currentLanguageId: string, timestampName: string) {
  t9nDetails.selectedLanguages.forEach(l => {
    const languageIsCurrentLanguage = l.id === currentLanguageId
    if (languageIsCurrentLanguage) {
      l[timestampName] = new Date()
    }
    return l
  })
}

function getNontranslatableElements(elementValues, elementIds) {
  return elementValues.filter(element => !elementIds.includes(element.element.id))
}

function getTranslatableElementIds(elements: ElementModels.ElementModel[]) {
  return elements
    .map(element => (element.type === 'text' || element.type === 'rich_text' ? element.id : undefined))
    .filter(element => element !== undefined)
}

export default httpTrigger
