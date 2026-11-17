import java.io.File;
import javax.xml.XMLConstants;
import javax.xml.validation.SchemaFactory;
import javax.xml.transform.stream.StreamSource;

public class ValidateBpmnXsd {
  public static void main(String[] args) throws Exception {
    SchemaFactory factory = SchemaFactory.newInstance(XMLConstants.W3C_XML_SCHEMA_NS_URI);
    factory.setProperty(XMLConstants.ACCESS_EXTERNAL_DTD, "");
    factory.setProperty(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "file");
    factory.newSchema(new File(args[0])).newValidator().validate(new StreamSource(new File(args[1])));
    System.out.println("PASS: exported BPMN matches BPMN 2.0 XSD");
  }
}
