below is an example of how to use the Azure OpenAI API to generate a response to a user's question about what to see in Paris. The example includes the necessary headers and body for the POST request, as well as some environment variables that may be needed for authentication and configuration. The user can use different models on the same example by changing the "model" field in the request body. The "reasoning_effort" field can also be adjusted to control the level of reasoning applied to the response.

```
curl -X POST "https://projecteck-resource.services.ai.azure.com/openai/v1/chat/completions" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer $AZURE_API_KEY" \
-d '{
    "messages": [
        {
            "role": "user",
            "content": "I am going to Paris, what should I see?"
        },
        {
            "role": "assistant",
            "content": "Paris, the capital of France, is known for its stunning architecture, art museums, historical landmarks, and romantic atmosphere. Here are some of the top attractions to see in Paris:\n\n1. The Eiffel Tower: The iconic Eiffel Tower is one of the most recognizable landmarks in the world and offers breathtaking views of the city.\n2. The Louvre Museum: The Louvre is one of the largest and most famous museums, housing an impressive collection of art and artifacts, including the Mona Lisa.\n3. Notre-Dame Cathedral: This beautiful cathedral is one of the most famous landmarks in Paris and is known for its Gothic architecture and stunning stained glass windows.\n\nThese are just a few of the many attractions that Paris has to offer. With so much to see and do, it is no wonder that Paris is one of the most popular tourist destinations in the world."
        },
        {
            "role": "user",
            "content": "What is so great about #1?"
        }
    ],
    "model": "gpt-5.5-teck",
    "max_completion_tokens": 4096,
    "reasoning_effort": "medium"
}'
```
```
AZURE_ENV_NAME="models-playground-6642"
AZURE_LOCATION="eastus2"
AZURE_SUBSCRIPTION_ID="d209a741-d3f2-4353-9ef2-6d989c0ea342"
AZURE_EXISTING_AIPROJECT_ENDPOINT="https://projecteck-resource.openai.azure.com/openai/v1/chat/completions"
AZURE_EXISTING_AIPROJECT_RESOURCE_ID="/subscriptions/d209a741-d3f2-4353-9ef2-6d989c0ea342/resourceGroups/rg-projecTeck/providers/Microsoft.CognitiveServices/accounts/projecteck-resource/projects/projecteck"
AZURE_EXISTING_RESOURCE_ID="/subscriptions/d209a741-d3f2-4353-9ef2-6d989c0ea342/resourceGroups/rg-projecTeck/providers/Microsoft.CognitiveServices/accounts/projecteck-resource"
AZD_ALLOW_NON_EMPTY_FOLDER=true
```
```
endpoint: https://projecteck-resource.services.ai.azure.com/api/projects/projecteck/openai/v1/responses
apiKey: 8VZcVZuL**********CCACHYHv6XJ3w3AAAAACOGttOS
```
