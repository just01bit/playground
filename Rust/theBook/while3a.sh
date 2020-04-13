#!/bin/sh
while read f
do
    case $f in 
        hello)          echo English ;;
        gday)           echo Australia ;;
        "guten tag")    echo German ;;
        *)              echo Unknow language: $f 
        ;;
    esac
done < myfile