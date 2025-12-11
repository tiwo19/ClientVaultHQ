import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

async function testS3Connection() {
  console.log("Testing AWS S3 Connection...\n");
  
  const region = process.env.AWS_REGION || "us-east-1";
  const bucket = process.env.AWS_S3_BUCKET;
  
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !bucket) {
    console.error("❌ Missing AWS credentials or bucket name");
    process.exit(1);
  }
  
  console.log(`Region: ${region}`);
  console.log(`Bucket: ${bucket}`);
  console.log(`Access Key: ${process.env.AWS_ACCESS_KEY_ID?.substring(0, 8)}...`);
  
  const s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const testKey = `test/connection-test-${Date.now()}.txt`;
  const testContent = "Work Digital Client Vault - S3 Connection Test - " + new Date().toISOString();

  try {
    console.log("\n1️⃣ Testing upload...");
    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: testContent,
      ContentType: "text/plain",
    }));
    console.log("   ✅ Upload successful!");

    console.log("\n2️⃣ Testing signed URL generation...");
    const signedUrl = await getSignedUrl(s3Client, new GetObjectCommand({
      Bucket: bucket,
      Key: testKey,
    }), { expiresIn: 3600 });
    console.log("   ✅ Signed URL generated!");
    console.log(`   URL preview: ${signedUrl.substring(0, 80)}...`);

    console.log("\n3️⃣ Testing delete...");
    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: testKey,
    }));
    console.log("   ✅ Delete successful!");

    console.log("\n🎉 All S3 tests passed! Your bucket is ready for document storage.");
    
  } catch (error: any) {
    console.error("\n❌ S3 Test Failed:");
    console.error(`   Error: ${error.message}`);
    if (error.Code) console.error(`   Code: ${error.Code}`);
    process.exit(1);
  }
}

testS3Connection();
