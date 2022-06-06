import chalk from "chalk";
import path from "path";
import yargs from "yargs";
import os from "os";

import { makeApplicationUrn, MessageSecurityMode, nodesets, OPCUAServer, SecurityPolicy, ServerSession, RegisterServerMethod, build_address_space_for_conformance_testing, install_optional_cpu_and_memory_usage_node, assert, Variant, DataType, StatusCodes, ApplicationDescription, BuildInfo } from "node-opcua";

async function main() {

    const port = 26543;
    const server_options = {
        port,
        resourcePath: "/UA/Heller", //This is adding up to the
        nodeset_filename: [nodesets.standard, nodesets.di],
        serverInfo: {
            applicationName: { text: "NodeOPCUA", locale: "en" },
            applicationUri: makeApplicationUrn(os.hostname(), "NodeOPCUA-Server"),
            productUri: "NodeOPCUA-Server",
            discoveryProfileUri: null,
            discoveryUrls: [],
            gatewayServerUri: null
        },
        buildInfo: {
            productName: "HellerServer",
            buildNumber: "7658",
            buildDate: new Date()
        },
        serverCapabilities: {
            maxBrowseContinuationPoints: 10,
            maxHistoryContinuationPoints: 10,
            // maxInactiveLockTime
            operationLimits: {
                maxNodesPerRead: 1000,
                maxNodesPerWrite: 1000,
                maxNodesPerHistoryReadData: 100,
                maxNodesPerBrowse: 1000,
                maxNodesPerMethodCall: 200,
            }
        },
        // userManager,
        registerServerMethod: RegisterServerMethod.HIDDEN,
        isAuditing: false
    };

    process.title = "Node OPCUA Server on port : " + server_options.port;

    // We create the server object instance and pass it the server_option
    const server = new OPCUAServer(server_options);

    // We initialize server
    await server.initialize();

    // We setup address space, objects and varaibles
    construct_my_address_space(server);

    // We start the server
    await server.start();

    const endpointUrl = server.getEndpointUrl()!;
    console.log(chalk.yellow("  server PID          :"), process.pid);
    console.log(chalk.yellow("  server on port      :"), chalk.cyan(server.endpoints[0].port.toString()));
    console.log(chalk.yellow("  endpointUrl         :"), chalk.cyan(endpointUrl));
    console.log(chalk.yellow("  serverInfo          :"));
    console.log(dumpObject(server.serverInfo));
    console.log(chalk.yellow("  buildInfo           :"));
    console.log(dumpObject(server.engine.buildInfo));

    // console.log(chalk.yellow("  Certificate rejected folder "), server.serverCertificateManager.rejectedFolder);
    // console.log(chalk.yellow("  Certificate trusted folder  "), server.serverCertificateManager.trustedFolder);
    // console.log(chalk.yellow("  Server private key          "), server.serverCertificateManager.privateKey);
    // console.log(chalk.yellow("  Server public key           "), server.certificateFile);
    // console.log(chalk.yellow("  X509 User rejected folder   "), server.userCertificateManager.trustedFolder);
    // console.log(chalk.yellow("  X509 User trusted folder    "), server.userCertificateManager.rejectedFolder);

    console.log(chalk.yellow("\n  server now waiting for connections. CTRL+C to stop"));

    server.on("create_session", (session: ServerSession) => {
        console.log(" SESSION CREATED");
        console.log(chalk.cyan("    client application URI: "), session.clientDescription!.applicationUri);
        console.log(chalk.cyan("        client product URI: "), session.clientDescription!.productUri);
        console.log(chalk.cyan("   client application name: "), session.clientDescription!.applicationName.toString());
        console.log(chalk.cyan("   client application type: "), session.clientDescription!.applicationType.toString());
        console.log(chalk.cyan("              session name: "), session.sessionName ? session.sessionName.toString() : "<null>");
        console.log(chalk.cyan("           session timeout: "), session.sessionTimeout);
        console.log(chalk.cyan("                session id: "), session.nodeId);
    });

    server.on("session_closed", (session: ServerSession, reason: string) => {
        console.log(" SESSION CLOSED :", reason);
        console.log(chalk.cyan("              session name: "), session.sessionName ? session.sessionName.toString() : "<null>");
    });

    process.on("SIGINT", async () => {
        // only work on linux apparently
        console.error(chalk.red.bold(" Received server interruption from user "));
        console.error(chalk.red.bold(" shutting down ..."));
        await server.shutdown(1000);
        console.error(chalk.red.bold(" shot down ..."));
        process.exit(1);
    });
}

function dumpObject(node: { [s: string]: unknown; } | ArrayLike<unknown> | ApplicationDescription | BuildInfo) {
    function w(str: string | [string, any], width: number) {
        const tmp = str + "                                        ";
        return tmp.substr(0, width);
    }
    return Object.entries(node).map((key, value) =>
        "      " + w(key, 30) + "  : " + ((value === null) ? null : value.toString())
    ).join("\n");
}

// We setup address space
function construct_my_address_space(server: OPCUAServer) {
    console.log(chalk.green("  setting namespace, devices and variables"));

    const addressSpace = server.engine.addressSpace;
    const namespace = addressSpace!.getOwnNamespace();

    //Should we create a device for every machine and consequently varaibles for each machine?
    const device = namespace.addObject({
        organizedBy: addressSpace!.rootFolder.objects,
        browseName: "Variables"
    });

    // add a variable named power to the newly created folder "MyDevice"
    let power = Math.floor(Math.random() * 10);
    let on = 0

    const powerVariable = namespace.addVariable({
        componentOf: device,
        nodeId: `ns=1;b=1020FFAA;`, // some opaque NodeId in namespace 4
        browseName: "power",
        dataType: "Double",
        value: new Variant({ dataType: DataType.Double, value: power })
    });

    const onVariable = namespace.addVariable({
        componentOf: device,
        nodeId: `ns=1;b=1020FFAB;`, // some opaque NodeId in namespace 4
        browseName: "on",
        dataType: "Double",
        value: new Variant({ dataType: DataType.Double, value: 1 })
    });

    setInterval(function () {
        var fluctuation = Math.floor(Math.random() * 10);
        powerVariable.setValueFromSource(new Variant({ dataType: DataType.Double, value: fluctuation }));
    }, 400);
}

// Entry function
main();
