import { AnalyzeExpenseCommand, ExpenseDocument } from '@aws-sdk/client-textract';
import { textractClient } from './aws-config';
import { UploadResult } from './s3-service';

export interface ExtractedReceiptData {
  description?: string; // User-entered description
  merchant?: string;
  total?: string;
  date?: string;
  tax?: string;
  subtotal?: string;
  address?: string;
  phone?: string;
  category?: string; // Expense category
  items?: Array<{
    description?: string;
    price?: string;
    quantity?: string;
  }>;
  rawData: unknown;
}

export class TextractService {
  static async analyzeExpense(s3Object: UploadResult): Promise<ExtractedReceiptData> {
    const command = new AnalyzeExpenseCommand({
      Document: {
        S3Object: {
          Bucket: s3Object.bucket,
          Name: s3Object.key,
        },
      },
    });

    try {
      console.log('=== TEXTRACT API CALL ===');
      console.log('S3 Object:', { bucket: s3Object.bucket, key: s3Object.key });
      
      const response = await textractClient.send(command);
      
      console.log('=== RAW TEXTRACT RESPONSE ===');
      console.log('Response metadata:', response.$metadata);
      console.log('Number of ExpenseDocuments:', response.ExpenseDocuments?.length || 0);
      
      if (response.ExpenseDocuments && response.ExpenseDocuments.length > 0) {
        console.log('=== FULL EXPENSE DOCUMENTS ===');
        console.log(JSON.stringify(response.ExpenseDocuments, null, 2));
      } else {
        console.log('⚠️ NO EXPENSE DOCUMENTS FOUND IN RESPONSE');
      }
      
      const parsedResult = this.parseExpenseResponse(response.ExpenseDocuments || []);
      
      console.log('=== FINAL PARSED RESULT ===');
      console.log(JSON.stringify(parsedResult, null, 2));
      console.log('================================');
      
      return parsedResult;
    } catch (error) {
      console.error('Error analyzing expense with Textract:', error);
      throw new Error('Failed to analyze receipt with Textract');
    }
  }

  static async analyzeExpenseFromBuffer(fileBuffer: Uint8Array): Promise<ExtractedReceiptData> {
    const command = new AnalyzeExpenseCommand({
      Document: {
        Bytes: fileBuffer,
      },
    });

    try {
      const response = await textractClient.send(command);
      return this.parseExpenseResponse(response.ExpenseDocuments || []);
    } catch (error) {
      console.error('Error analyzing expense with Textract:', error);
      throw new Error('Failed to analyze receipt with Textract');
    }
  }

  private static parseExpenseResponse(expenseDocuments: ExpenseDocument[]): ExtractedReceiptData {
    console.log('=== PARSING EXPENSE RESPONSE ===');
    console.log('ExpenseDocuments count:', expenseDocuments.length);
    
    const result: ExtractedReceiptData = {
      items: [],
      rawData: expenseDocuments,
    };

    if (expenseDocuments.length === 0) {
      console.log('⚠️ No expense documents to parse');
      return result;
    }

    const document = expenseDocuments[0];
    console.log('Processing document with:');
    console.log('- SummaryFields count:', document.SummaryFields?.length || 0);
    console.log('- LineItemGroups count:', document.LineItemGroups?.length || 0);

    // Process Summary Fields (main receipt data)
    console.log('=== PROCESSING SUMMARY FIELDS ===');
    document.SummaryFields?.forEach((field, index) => {
      const type = field.Type?.Text?.toLowerCase();
      const value = field.ValueDetection?.Text;
      const confidence = field.ValueDetection?.Confidence;

      console.log(`Field ${index + 1}:`, {
        type: field.Type?.Text,
        normalizedType: type,
        value: value,
        confidence: confidence,
        hasValue: !!value
      });

      if (!type || !value) {
        console.log(`  ⚠️ Skipping field - missing type or value`);
        return;
      }

      switch (type) {
        case 'vendor_name':
        case 'merchant_name':
          result.merchant = value;
          console.log(`  ✅ Set merchant: "${value}"`);
          break;
        case 'total':
        case 'amount_paid':
          result.total = value;
          console.log(`  ✅ Set total: "${value}"`);
          break;
        case 'invoice_receipt_date':
        case 'date':
          result.date = value;
          console.log(`  ✅ Set date: "${value}"`);
          break;
        case 'tax':
          result.tax = value;
          console.log(`  ✅ Set tax: "${value}"`);
          break;
        case 'subtotal':
          result.subtotal = value;
          console.log(`  ✅ Set subtotal: "${value}"`);
          break;
        case 'vendor_address':
        case 'merchant_address':
          result.address = value;
          console.log(`  ✅ Set address: "${value}"`);
          break;
        case 'vendor_phone':
        case 'merchant_phone':
          result.phone = value;
          console.log(`  ✅ Set phone: "${value}"`);
          break;
        default:
          console.log(`  ❓ Unknown field type: "${type}" with value: "${value}"`);
          break;
      }
    });

    // Process Line Items
    console.log('=== PROCESSING LINE ITEMS ===');
    document.LineItemGroups?.forEach((group, groupIndex) => {
      console.log(`LineItemGroup ${groupIndex}:`, {
        lineItemsCount: group.LineItems?.length || 0
      });
      
      group.LineItems?.forEach((lineItem, itemIndex) => {
        console.log(`  LineItem ${itemIndex}:`, {
          fieldsCount: lineItem.LineItemExpenseFields?.length || 0
        });
        
        const item: Record<string, string> = {};
        
        lineItem.LineItemExpenseFields?.forEach((field, fieldIndex) => {
          const type = field.Type?.Text?.toLowerCase();
          const value = field.ValueDetection?.Text;
          const confidence = field.ValueDetection?.Confidence;

          console.log(`    Field ${fieldIndex}:`, {
            type: field.Type?.Text,
            normalizedType: type,
            value: value,
            confidence: confidence,
            hasValue: !!value
          });

          if (!type || !value) {
            console.log(`      ⚠️ Skipping line item field - missing type or value`);
            return;
          }

          switch (type) {
            case 'item':
            case 'product_code':
              item.description = value;
              console.log(`      ✅ Set item description: "${value}"`);
              break;
            case 'price':
            case 'unit_price':
              item.price = value;
              console.log(`      ✅ Set item price: "${value}"`);
              break;
            case 'quantity':
              item.quantity = value;
              console.log(`      ✅ Set item quantity: "${value}"`);
              break;
            default:
              console.log(`      ❓ Unknown line item field type: "${type}" with value: "${value}"`);
              break;
          }
        });

        console.log(`    Final item object:`, item);
        if (Object.keys(item).length > 0) {
          result.items?.push(item);
          console.log(`    ✅ Added item to results (total items: ${result.items?.length})`);
        } else {
          console.log(`    ⚠️ Item object empty, not adding to results`);
        }
      });
    });

    console.log('=== FINAL PARSING RESULT ===');
    console.log('Result summary:', {
      hasMerchant: !!result.merchant,
      hasTotal: !!result.total,
      hasDate: !!result.date,
      hasTax: !!result.tax,
      hasSubtotal: !!result.subtotal,
      hasAddress: !!result.address,
      hasPhone: !!result.phone,
      itemsCount: result.items?.length || 0,
      hasRawData: !!result.rawData
    });
    console.log('Full result object:');
    console.log('- merchant:', result.merchant);
    console.log('- total:', result.total);
    console.log('- date:', result.date);
    console.log('- tax:', result.tax);
    console.log('- subtotal:', result.subtotal);
    console.log('- address:', result.address);
    console.log('- phone:', result.phone);
    console.log('- items:', result.items);
    console.log('=== END PARSING RESULT ===');

    return result;
  }
}