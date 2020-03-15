// Sample code to fork edmx2csn command and to check the errors from edmx2csn are propagated back to child process.
const exec = require('child_process').exec;
const cmd = '..\\bin\\edmx2csn.cmd -i ..\\test\\input\\invalid_edmx.xml -o ..\\test\\output\\';
exec(cmd, (e, stdout, stderr)=> {
    console.error('From process invocation:');
    console.error(stderr);
});
