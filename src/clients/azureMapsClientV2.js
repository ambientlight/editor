const baseURL = "https://us.atlas.microsoft.com";

const resourceEndpoints = {
  data: "/mapData",
  conversion: "/conversions",
  dataset: "/datasets",
  tileset: "/tilesets",
};

const getIdFromURI = (uri) => {
  return new URL(uri).pathname.split("/").pop() || "";
}

export default class AzureMapsClientV2 {
  constructor(subscriptionKey) {
    this.subscriptionKey = subscriptionKey;
  }

  uploadPackage = async (pkg) => {
    const url = new URL(`${baseURL}${resourceEndpoints["data"]}`);
    url.searchParams.append("api-version", "2.0");
    url.searchParams.append("dataFormat", "dwgzippackage");
    url.searchParams.append("subscription-key", this.subscriptionKey);

    const request = new Request(url, {
      method: "POST",
      body: pkg,
      headers: {
        "Content-Type": "application/octet-stream"
      }
    });

    const response = await fetch(request);
    return this.translateStartResponse(response);
  }

   convertPackage = async (udid) => {
    const url = new URL(`${baseURL}${resourceEndpoints["conversion"]}`);
    url.searchParams.append("api-version", "2.0");
    url.searchParams.append("udid", udid);
    url.searchParams.append("outputOntology", "facility-2.0");
    url.searchParams.append("subscription-key", this.subscriptionKey);

    const request = new Request(url, { method: "POST" })
    const response = await fetch(request);
    return this.translateStartResponse(response);
  }

  createDataset = async (conversionId) => {
    const url = new URL(`${baseURL}${resourceEndpoints["dataset"]}`);
    url.searchParams.append("api-version", "2.0");
    url.searchParams.append("conversionId", conversionId);
    url.searchParams.append("subscription-key", this.subscriptionKey);

    const request = new Request(url, { method: "POST" })
    const response = await fetch(request);
    return this.translateStartResponse(response);
  }

  createTileset = async (datasetId) => {
    const url = new URL(`${baseURL}${resourceEndpoints["tileset"]}`);
    url.searchParams.append("api-version", "2.0");
    url.searchParams.append("datasetId", datasetId);
    url.searchParams.append("subscription-key", this.subscriptionKey);

    const request = new Request(url, { method: "POST" })
    const response = await fetch(request);
    return this.translateStartResponse(response);
  }

  getOperationStatus = async (operationType, operationId) => {
    const url = new URL(`${baseURL}${resourceEndpoints[operationType]}/operations/${operationId}`);
    url.searchParams.append("api-version", "2.0");
    url.searchParams.append("subscription-key", this.subscriptionKey);

    const request = new Request(url)
    const response = await fetch(request);
    return this.translateOperationResponse(response);
  }

  getOperationStatusUntilSucceed = async (operationType, operationId, delay) => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    for (let i=0; ; i++) {
      const response = await this.getOperationStatus(operationType, operationId)
      if (response.type === "status" && response.status === "Succeeded") {
        return response;
      }
      await wait(delay);
    }
  }

  translateStartResponse = async (response) => {
    switch (response.status) {
      case 202: {
        const operationLocation = response.headers.get("operation-location");
        return {
          type: "accepted",
          operationId: getIdFromURI(operationLocation || ""),
        };
      }
      default:
       throw {
          type: "error",
          inner: await response.json(),
        };
    }
  }

  translateOperationResponse = async (response) => {
    switch (response.status) {
      case 200: { // still running or done
        const location = response.headers.get("resource-location");
        if (location) {
          const resourceId = getIdFromURI(location);
          const { status } = await response.json();
          return {
            type: "status",
            status,
            resourceId
          };
        } else {
          const { status } = await response.json();
          return {
            type: "status",
            status
          };
        }
      }
      default:
        throw { type: "error", inner: await response.json()};
    }
  }
}
