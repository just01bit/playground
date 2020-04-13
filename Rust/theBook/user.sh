#!/bin/sh
echo "What's your name?"
read USER_NAME
echo "Hello $USER_NAME"
echo "We will create you a file called ${USER_NAME}_file"
touch ${USER_NAME}_file