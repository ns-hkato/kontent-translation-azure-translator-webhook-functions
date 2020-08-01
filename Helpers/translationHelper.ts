import { ElementModels, SharedModels } from '@kentico/kontent-management'
import axios from 'axios'
import { Constants } from './constants'

export async function translate(
  elementValues: ElementModels.ContentItemElement[],
  languageCodename: string
): Promise<ElementModels.ContentItemElement[]> {
  return await translateWithAzure(elementValues, languageCodename)
}

async function translateWithAzure(
  elementValues: ElementModels.ContentItemElement[],
  languageCodename: string
): Promise<ElementModels.ContentItemElement[]> {
  if (!Constants.azureTranslatorTextKey) {
    throw Error('Azure Translator Text Key is undefined')
  }
  if (!Constants.azureTranslatorTextEndpoint) {
    throw Error('Azure Translator Text Endpoint is undefined')
  }

  interface TranslationData {
    text: string | number | SharedModels.ReferenceObject[]
  }

  const translatorTextData: TranslationData[] = elementValues.map((element) => ({
    text: element.value,
  }))

  const translatorTextUrl = `${Constants.azureTranslatorTextEndpoint}translate?api-version=3.0&textType=html&from=ja&to=${languageCodename}`

  const response = await axios.post(translatorTextUrl, translatorTextData, {
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': Constants.azureTranslatorTextKey,
    },
  })
  elementValues.forEach((element, index) => {
    element.value = response.data[index].translations[0].text.replace(/<br>/g, '<br/>')
  })

  return elementValues
}
