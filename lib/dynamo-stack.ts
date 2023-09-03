import { CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { camelCaseToSnakeCase, getResourceNameWithPrefix } from '../util';
import { BasicStackProps } from '../interfaces';

export class DynamoStack extends Stack {
  public readonly personalInformationTable: Table;
  public readonly medicalHistoryTable: Table;
  public readonly productTable: Table;
  public readonly orderTable: Table;
  private readonly stage: string;

  constructor(scope: Construct, id: string, props: BasicStackProps) {
    super(scope, id);
    this.stage = props.stage;

    this.personalInformationTable = this.createTable('PersonalInformation', 'userId');
    this.medicalHistoryTable = this.createTable('MedicalHistory', 'userId');
    this.productTable = this.createTable('Product', 'id');
    this.orderTable = this.createTable('Order', 'userId', 'id');

    this.addGlobalSecondaryIndexes();
    this.exportTableNames();
  }

  createTable(name: string, pk: string, sk?: string) {
    let sortKey = sk ? { name: sk, type: AttributeType.STRING } : undefined;
    const nameSnakeCase = camelCaseToSnakeCase(name);
    return new Table(this, `${name}Table`, {
      partitionKey: {
        name: pk,
        type: AttributeType.STRING,
      },
      sortKey,
      tableName: getResourceNameWithPrefix(`${nameSnakeCase}-table-${this.stage}`),
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
    });
  }

  addGlobalSecondaryIndexes() {
    this.addGlobalSecondaryIndex(this.medicalHistoryTable, 'drugsUseHistory');
    this.addGlobalSecondaryIndex(this.orderTable, 'status', 'date');
    this.addGlobalSecondaryIndex(this.orderTable, 'paymentMethod', 'userId');
    this.addGlobalSecondaryIndex(this.productTable, 'code');
    this.addGlobalSecondaryIndex(this.productTable, 'category');
    // this.addGlobalSecondaryIndex(this.productTable, 'price');
  }

  addGlobalSecondaryIndex(table: Table, pk: string, sk?: string) {
    let sortKey = sk ? { name: sk, type: AttributeType.STRING } : undefined;
    table.addGlobalSecondaryIndex({
      indexName: `${pk}GSI`,
      partitionKey: {
        name: pk,
        type: AttributeType.STRING,
      },
      sortKey,
    });
  }

  exportTableNames() {
    new CfnOutput(this, 'PersonalInformationTableName', {
      value: this.personalInformationTable.tableName,
      exportName: getResourceNameWithPrefix(`personal-information-table-name-${this.stage}`),
    });
    new CfnOutput(this, 'MedicalHistoryTableName', {
      value: this.medicalHistoryTable.tableName,
      exportName: getResourceNameWithPrefix(`medical-history-table-name-${this.stage}`),
    });
    new CfnOutput(this, 'ProductTableName', {
      value: this.productTable.tableName,
      exportName: getResourceNameWithPrefix(`product-table-name-${this.stage}`),
    });
    new CfnOutput(this, 'OrderTableName', {
      value: this.orderTable.tableName,
      exportName: getResourceNameWithPrefix(`order-table-name-${this.stage}`),
    });
  }
}
