import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";
import { URL_TTL_SEC, type StorageAdapter } from "./index";

let client: S3Client | undefined;

function s3(): S3Client {
  if (!client) {
    const e = env();
    client = new S3Client({
      region: "auto",
      endpoint: `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: e.R2_ACCESS_KEY_ID!, secretAccessKey: e.R2_SECRET_ACCESS_KEY! },
    });
  }
  return client;
}

export function r2StorageAdapter(): StorageAdapter {
  const bucket = env().R2_BUCKET!;
  return {
    remove: async (key) => {
      await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    putUrl: (key, contentType) =>
      getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn: URL_TTL_SEC }),
    getUrl: (key, o) =>
      getSignedUrl(
        s3(),
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          ResponseContentType: o.contentType,
          ResponseContentDisposition: `${o.download ? "attachment" : "inline"}; filename="${o.filename}"`,
        }),
        { expiresIn: URL_TTL_SEC },
      ),
  };
}
