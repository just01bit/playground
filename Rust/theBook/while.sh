#!/bin/sh
#INPUT_STRING=hello
while [ "$INPUT_STRING" != "bye" ]
do
    echo "please type something in (bye to quite)"
    read INPUT_STRING
    echo "you typed: $INPUT_STRING"
done 